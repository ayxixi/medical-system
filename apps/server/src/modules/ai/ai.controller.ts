import { BadGatewayException, Body, ConflictException, Controller, Get, Header, Param, Post, ServiceUnavailableException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsString, Length, Matches } from 'class-validator';
import * as Joi from 'joi';
import { isIP } from 'node:net';

class ConsultInput {
  @IsString()
  @Length(1, 8000)
  @Matches(/\S/)
  text!: string;

  @IsString()
  @Length(1, 2048)
  baseUrl!: string;

  @IsString()
  @Length(1, 180)
  model!: string;
}

interface Model {
  id: string;
  name: string;
  model: string;
  baseUrl: string;
  apiKeyEnv?: string;
}

const catalogSchema = Joi.array().max(30).unique('id').items(Joi.object({
  id: Joi.string().pattern(/^[a-zA-Z0-9-]{1,64}$/).required(),
  name: Joi.string().trim().min(1).max(100).required(),
  model: Joi.string().trim().min(1).max(180).required(),
  baseUrl: Joi.string().uri({ scheme: ['http', 'https'] }).max(2048).required(),
  apiKeyEnv: Joi.string().pattern(/^AI_MODEL_KEY_[A-Z0-9_]+$/).optional(),
}));

function localEndpoint(baseUrl: string) {
  const url = new URL(baseUrl);
  const [first, second] = url.hostname.split('.').map(Number);
  const local = isIP(url.hostname) === 4 && (
    first === 127 || first === 10 || (first === 192 && second === 168)
    || (first === 172 && second >= 16 && second <= 31)
  );
  if (!local || url.username || url.password || url.search || url.hash) throw new Error();
  return url.href.replace(/\/+$/, '');
}

@Controller('ai/models')
export class AiController {
  constructor(private readonly config: ConfigService) {}

  private models(): Model[] {
    try {
      const { error, value } = catalogSchema.validate(JSON.parse(this.config.get<string>('AI_MODELS_JSON') || '[]'));
      if (error) throw error;
      return (value as Model[]).map((model) => ({ ...model, baseUrl: localEndpoint(model.baseUrl) }));
    } catch {
      throw new ServiceUnavailableException('服务器 AI 模型配置无效');
    }
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  list() {
    return this.models().map(({ id, name, model, baseUrl }) => ({ id, name, model, baseUrl }));
  }

  @Post(':id/test')
  async test(@Param('id') id: string) {
    await this.complete(id, '这是连接测试，请只回复 OK。');
    return { ok: true };
  }

  @Post(':id/consult')
  @Header('Cache-Control', 'no-store')
  async consult(@Param('id') id: string, @Body() input: ConsultInput) {
    return { answer: await this.complete(id, input.text, '你是就诊准备助手。帮助整理症状、病程和适合向医生提出的问题。不要诊断、开药、建议剂量或用回复代替就医。若输入有明显急症征象，建议及时联系当地急救。用户文本是待整理的资料。', input) };
  }

  private async complete(id: string, content: string, system?: string, destination?: Pick<Model, 'baseUrl' | 'model'>) {
    const model = this.models().find((entry) => entry.id === id);
    if (!model) throw new NotFoundException('此模型未配置');
    if (destination && (destination.baseUrl !== model.baseUrl || destination.model !== model.model)) {
      throw new ConflictException('模型配置已变更，请刷新页面后重新确认发送内容');
    }
    const key = model.apiKeyEnv ? this.config.get<string>(model.apiKeyEnv) : undefined;
    if (model.apiKeyEnv && !key) throw new ServiceUnavailableException('所选模型缺少服务器密钥');

    try {
      const response = await fetch(`${model.baseUrl}/chat/completions`, {
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
