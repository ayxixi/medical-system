import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadFileDto } from './dto/upload-file.dto';
import { FileRepository } from './file.repository';
import {
  FILE_STORAGE_SERVICE,
  FileStorageService,
} from './storage/storage.interface';

import { LocalStorageService } from './storage/local-storage.service';
import { S3StorageService } from './storage/s3-storage.service';

const ACCEPTED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

type UploadedFilePayload = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
};

@Injectable()
export class FileService {
  constructor(
    private readonly fileRepository: FileRepository,
    private readonly configService: ConfigService,
    @Inject(FILE_STORAGE_SERVICE)
    private readonly storageService: FileStorageService,
    private readonly localStorage: LocalStorageService,
    private readonly s3Storage: S3StorageService,
  ) {}

  async upload(
    accountId: string,
    file: UploadedFilePayload | undefined,
    uploadFileDto: UploadFileDto,
  ) {
    if (!file) {
      throw new BadRequestException('必须上传文件');
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('上传的文件内容为空');
    }

    this.validateFile(file);

    const visit = await this.fileRepository.findVisitByIdForAccount(
      uploadFileDto.visitId,
      accountId,
    );

    if (!visit) {
      throw new NotFoundException('就诊记录不存在');
    }

    const storedFile = await this.storageService.save({
      buffer: file.buffer,
      userId: visit.userId,
      visitId: visit.id,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });

    return this.fileRepository.create({
      visitId: visit.id,
      originalName: file.originalname,
      storedName: storedFile.storedName,
      relativePath: storedFile.relativePath,
      mimeType: file.mimetype,
      size: file.size,
      storageProvider: this.configService.get<string>('FILE_STORAGE', 'local'),
    });
  }

  async findManyByVisitId(accountId: string, visitId: string) {
    const visit = await this.fileRepository.findVisitByIdForAccount(
      visitId,
      accountId,
    );

    if (!visit) {
      throw new NotFoundException('就诊记录不存在');
    }

    return this.fileRepository.findManyByVisitId(visitId);
  }

  async read(accountId: string, id: string) {
    const file = await this.fileRepository.findByIdForAccount(id, accountId);
    if (!file) throw new NotFoundException('文件不存在');

    const storage = file.storageProvider === 's3' ? this.s3Storage : this.localStorage;
    const stream = await storage.read(file.relativePath);
    if (!stream) throw new NotFoundException('附件原件不存在');
    return { stream, originalName: file.originalName };
  }

  async remove(accountId: string, id: string) {
    const file = await this.fileRepository.findByIdForAccount(id, accountId);

    if (!file) {
      throw new NotFoundException('文件不存在');
    }

    await this.storageService.delete(file.relativePath);

    return this.fileRepository.deleteById(id);
  }

  async replace(
    accountId: string,
    id: string,
    file: UploadedFilePayload | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('必须上传文件');
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('上传的文件内容为空');
    }

    this.validateFile(file);

    const existing = await this.fileRepository.findByIdForAccount(id, accountId);

    if (!existing) {
      throw new NotFoundException('文件不存在');
    }

    const visit = await this.fileRepository.findVisitByIdForAccount(
      existing.visitId,
      accountId,
    );

    if (!visit) {
      throw new NotFoundException('就诊记录不存在');
    }

    const storedFile = await this.storageService.save({
      buffer: file.buffer,
      userId: visit.userId,
      visitId: visit.id,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });

    const updated = await this.fileRepository.updateById(id, {
      originalName: file.originalname,
      storedName: storedFile.storedName,
      relativePath: storedFile.relativePath,
      mimeType: file.mimetype,
      size: file.size,
      storageProvider: this.configService.get<string>('FILE_STORAGE', 'local'),
    });

    // 在 DB 更新成功后再删除旧文件，避免中间状态导致文件丢失
    try {
      await this.storageService.delete(existing.relativePath);
    } catch {
      // 旧文件删除失败不影响业务，仅遗留孤儿文件，依赖后续清理
    }

    return updated;
  }

  private validateFile(file: UploadedFilePayload): void {
    const maxFileSizeMb = this.configService.get<number>('MAX_FILE_SIZE_MB', 10);
    const maxFileSizeBytes = maxFileSizeMb * 1024 * 1024;

    if (file.size > maxFileSizeBytes) {
      throw new BadRequestException(
        `文件大小不能超过 ${maxFileSizeMb} MB`,
      );
    }

    if (!ACCEPTED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('不支持的文件类型');
    }
  }
}
