import { BadGatewayException, BadRequestException, Body, ConflictException, Controller, Get, Header, Param, Post, Put, ServiceUnavailableException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsArray, IsString, Length, Matches } from 'class-validator';
import * as Joi from 'joi';
import { isIP } from 'node:net';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedAccount, CurrentAccount } from '../auth/decorators/current-account.decorator';

class SaveModelSettings {
  @IsArray()
  models!: unknown[];
}

class ModelDestination {
  @IsString()
  @Length(1, 2100)
  baseUrl!: string;

  @IsString()
  @Length(1, 180)
  model!: string;
}

class ConsultInput extends ModelDestination {
  @IsString()
  @Length(1, 8000)
  @Matches(/\S/)
  text!: string;
}

interface Model {
  id: string;
  name: string;
  model: string;
  baseUrl: string;
  exactEndpoint?: boolean;
  enabled?: boolean;
  isDefault?: boolean;
  apiKeyEnv?: string;
}

const modelFields = {
  id: Joi.string().pattern(/^[a-zA-Z0-9-]{1,64}$/).required(),
  name: Joi.string().trim().min(1).max(100).required(),
  model: Joi.string().trim().min(1).max(180).required(),
  baseUrl: Joi.string().uri({ scheme: ['http', 'https'] }).max(2048).required(),
  exactEndpoint: Joi.boolean().optional(),
  enabled: Joi.boolean().optional(),
  isDefault: Joi.boolean().optional(),
};
const settingsSchema = Joi.array().max(30).unique('id').items(Joi.object(modelFields));
const catalogSchema = Joi.array().max(30).unique('id').items(Joi.object({
  ...modelFields,
  apiKeyEnv: Joi.string().pattern(/^AI_MODEL_KEY_[A-Z0-9_]+$/).optional(),
}));

function parseEndpoint(baseUrl: string) {
  const url = new URL(baseUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error();
  }
  return url;
}

function localEndpoint(baseUrl: string) {
  const url = parseEndpoint(baseUrl);
  const [first, second] = url.hostname.split('.').map(Number);
  const local = isIP(url.hostname) === 4 && (
    first === 127 || first === 10 || (first === 192 && second === 168)
    || (first === 172 && second >= 16 && second <= 31)
  );
  if (!local) throw new Error();
  return url.href.replace(/\/+$/, '');
}

function completionEndpoint(model: Model) {
  return model.exactEndpoint || model.baseUrl.endsWith('/chat/completions')
    ? model.baseUrl
    : `${model.baseUrl}/chat/completions`;
}

@Controller('ai/models')
export class AiController {
  constructor(private readonly config: ConfigService, private readonly prisma: PrismaService) {}

  private configuredModels(): Model[] {
    try {
      const { error, value } = catalogSchema.validate(JSON.parse(this.config.get<string>('AI_MODELS_JSON') || '[]'));
      if (error) throw error;
      return (value as Model[]).map((model) => ({ ...model, baseUrl: localEndpoint(model.baseUrl) }));
    } catch {
      throw new ServiceUnavailableException('服务器 AI 模型配置无效');
    }
  }

  private async accountModels(accountId: string): Promise<Model[]> {
    const account = await this.prisma.account.findUniqueOrThrow({
      where: { id: accountId }, select: { aiModelsJson: true },
    });
    return account.aiModelsJson === null
      ? this.configuredModels()
      : JSON.parse(account.aiModelsJson) as Model[];
  }

  private approved(model: Model) {
    const endpoint = completionEndpoint(model);
    try {
      localEndpoint(endpoint);
    } catch {
      return false;
    }
    return this.configuredModels().some((entry) => completionEndpoint(entry) === endpoint)
      || (this.config.get<string>('AI_MODEL_ALLOWED_ENDPOINTS') ?? '').split(',')
        .map((entry) => entry.trim()).includes(endpoint);
  }

  private publicModel({ id, name, model, baseUrl, exactEndpoint, enabled, isDefault }: Model) {
    const entry = { id, name, model, baseUrl, exactEndpoint: Boolean(exactEndpoint) };
    return { ...entry, endpoint: completionEndpoint(entry), enabled: enabled !== false,
      isDefault: Boolean(isDefault), approved: this.approved(entry) };
  }

  private parseModels(input: unknown): Model[] {
    const { error, value } = settingsSchema.validate(input);
    if (error) throw new BadRequestException('请检查模型名称、地址和数量（最多 30 个）');
    try {
      return (value as Model[]).map((entry) => ({
        ...entry, baseUrl: parseEndpoint(entry.baseUrl).href.replace(/\/+$/, ''),
      }));
    } catch {
      throw new BadRequestException('请填写不含凭据、查询参数和片段的 HTTP/HTTPS 地址');
    }
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  async list(@CurrentAccount() account: AuthenticatedAccount) {
    return (await this.accountModels(account.id)).map((entry) => this.publicModel(entry))
      .filter((entry) => entry.enabled && entry.approved);
  }

  @Get('settings')
  @Header('Cache-Control', 'no-store')
  async settings(@CurrentAccount() account: AuthenticatedAccount) {
    return (await this.accountModels(account.id)).map((entry) => this.publicModel(entry));
  }

  @Put('settings')
  async save(@CurrentAccount() account: AuthenticatedAccount, @Body() input: SaveModelSettings) {
    const models = this.parseModels(input.models);
    if (models.filter((entry) => entry.isDefault).length > 1
      || models.some((entry) => entry.isDefault && entry.enabled === false)) {
      throw new BadRequestException('只能将一个已启用的模型设为默认');
    }
    if (models.some((entry) => entry.enabled !== false && !this.approved(entry))) {
      throw new BadRequestException('启用前请由部署者批准模型的完整请求地址');
    }
    await this.prisma.account.update({
      where: { id: account.id }, data: { aiModelsJson: JSON.stringify(models) }, select: { id: true },
    });
    return models.map((entry) => this.publicModel(entry));
  }

  @Post('settings/test')
  async testSettings(@Body() input: SaveModelSettings) {
    const [model, extra] = this.parseModels(input.models);
    if (!model || extra) throw new BadRequestException('请选择一个模型进行测试');
    await this.complete(model, '这是连接测试，请只回复 OK。');
    return { ok: true };
  }

  @Post(':id/test')
  async test(@CurrentAccount() account: AuthenticatedAccount, @Param('id') id: string) {
    await this.complete(await this.findModel(account.id, id), '这是连接测试，请只回复 OK。');
    return { ok: true };
  }

  @Post(':id/test-draft')
  async testDraft(@CurrentAccount() account: AuthenticatedAccount, @Param('id') id: string, @Body() destination: ModelDestination) {
    await this.complete(await this.findModel(account.id, id), '这是连接测试，请只回复 OK。', undefined, destination);
    return { ok: true };
  }

  @Post(':id/consult')
  @Header('Cache-Control', 'no-store')
  async consult(@CurrentAccount() account: AuthenticatedAccount, @Param('id') id: string, @Body() input: ConsultInput) {
    return { answer: await this.complete(await this.findModel(account.id, id), input.text, '你是就诊准备助手。帮助整理症状、病程和适合向医生提出的问题。不要诊断、开药、建议剂量或用回复代替就医。若输入有明显急症征象，建议及时联系当地急救。用户文本是待整理的资料。', input) };
  }

  private async findModel(accountId: string, id: string) {
    const model = (await this.accountModels(accountId)).find((entry) => entry.id === id && entry.enabled !== false);
    if (!model) throw new NotFoundException('此模型未配置或未启用');
    return model;
  }

  private async complete(model: Model, content: string, system?: string, destination?: Pick<Model, 'baseUrl' | 'model'>) {
    if (!this.approved(model)) throw new BadRequestException('此请求地址尚未由部署者批准');
    const endpoint = completionEndpoint(model);
    // Older clients sent the base URL. Accept it only for the original append-path mode.
    const originalMode = !model.exactEndpoint && endpoint !== model.baseUrl;
    const matchesAddress = destination?.baseUrl === endpoint
      || (originalMode && destination?.baseUrl === model.baseUrl);
    if (destination && (!matchesAddress || destination.model !== model.model)) {
      throw new ConflictException('模型配置已变更，请刷新页面后重新确认发送内容');
    }
    const credential = this.configuredModels().find((entry) =>
      entry.model === model.model && completionEndpoint(entry) === endpoint && entry.apiKeyEnv)?.apiKeyEnv;
    const key = credential ? this.config.get<string>(credential) : undefined;
    if (credential && !key) throw new ServiceUnavailableException('所选模型缺少服务器密钥');

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(28_000),
        headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
        body: JSON.stringify({
          model: model.model,
          messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content }],
          max_tokens: system ? 1200 : 32,
          stream: false,
        }),
      });
      if (!response.body) throw new Error();
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let text = '';
      let size = 0;
      try {
        if (!response.ok) throw new Error();
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > 256_000) throw new Error();
          text += decoder.decode(chunk.value, { stream: true });
        }
        text += decoder.decode();
      } finally {
        await reader.cancel().catch(() => undefined);
      }
      const answer: unknown = JSON.parse(text)?.choices?.[0]?.message?.content;
      if (typeof answer !== 'string' || !answer.trim()) throw new Error();
      return answer.trim();
    } catch {
      throw new BadGatewayException('模型未返回有效回复，请检查连接、模型名称和服务器密钥');
    }
  }
}
