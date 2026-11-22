import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { RecognitionService } from './recognition.service';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const AUDIO_TYPES = [
  'audio/webm', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp4', 'audio/aac',
];

interface UploadedMedia {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

@Controller('recognition')
export class RecognitionController {
  constructor(
    private readonly recognition: RecognitionService,
    private readonly config: ConfigService,
  ) {}

  @Post('ocr')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  ocr(@UploadedFile() file: UploadedMedia | undefined) {
    this.validateFile(file, IMAGE_TYPES, '请选择 JPEG、PNG 或 WebP 图片。');
    return this.recognition.recognize('ocr', file);
  }

  @Post('transcribe')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  transcribe(@UploadedFile() file: UploadedMedia | undefined) {
    this.validateFile(file, AUDIO_TYPES, '录音格式不受支持，请使用浏览器录音或选择 WebM、WAV、MP3、M4A 文件。');
    return this.recognition.recognize('transcribe', file);
  }

  private validateFile(file: UploadedMedia | undefined, types: string[], message: string): asserts file is UploadedMedia {
    if (!file) throw new BadRequestException('请选择要识别的媒体文件。');
    const maxSize = this.config.get<number>('RECOGNITION_MAX_FILE_SIZE_MB', 10) * 1024 * 1024;
    if (file.size > maxSize) throw new BadRequestException(`媒体文件不能超过 ${Math.floor(maxSize / 1024 / 1024)} MB。`);
    if (!types.includes(file.mimetype)) throw new BadRequestException(message);
  }
}
