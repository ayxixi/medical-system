import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface UploadedMedia {
  buffer: Buffer;
  mimetype: string;
}

export type RecognitionKind = 'ocr' | 'transcribe';

@Injectable()
export class RecognitionService {
  private readonly logger = new Logger(RecognitionService.name);

  constructor(private readonly config: ConfigService) {}

  async recognize(kind: RecognitionKind, file: UploadedMedia) {
    const baseUrl = this.config.get<string>('RECOGNITION_WORKER_URL')?.replace(/\/$/, '');
    const apiKey = this.config.get<string>('RECOGNITION_API_KEY');
    if (!baseUrl || !apiKey) {
      throw new ServiceUnavailableException('本机识别服务未启用，请联系管理员配置识别组件；也可继续手动录入。');
    }

    try {
      const response = await fetch(`${baseUrl}/${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Recognition-Key': apiKey },
        body: JSON.stringify({ content: file.buffer.toString('base64'), mimeType: file.mimetype }),
        signal: AbortSignal.timeout(this.config.get<number>('RECOGNITION_TIMEOUT_MS', 180000)),
      });
      if (response.status === 413) throw new BadGatewayException('媒体文件超过识别服务限制。');
      if (response.status === 429) {
        throw new HttpException('识别服务正在处理其他任务，请稍后重试。', HttpStatus.TOO_MANY_REQUESTS);
      }
      if (!response.ok) throw new Error('Recognition worker rejected the request');
      const result: { text?: unknown } = await response.json();
      if (typeof result?.text !== 'string') {
        throw new Error('Invalid recognition response');
      }
      return { text: result.text };
    } catch (error) {
      if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)) {
        throw new BadGatewayException('识别处理超时，请缩短录音或稍后重试。');
      }
      if (error instanceof TypeError) {
        this.logger.warn('识别工作进程不可用');
        throw new ServiceUnavailableException('本机识别服务暂不可用，请稍后重试或手动录入。');
      }
      if (error instanceof BadGatewayException) throw error;
      if (error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS) {
        throw error;
      }
      this.logger.warn('本机识别处理失败');
      throw new BadGatewayException('识别失败，请尝试更清晰的图片或更短的录音。');
    }
  }
}
