import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { AttachmentCleanupService } from './attachment-cleanup.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { FileRepository } from './file.repository';
import {
  FILE_STORAGE_SERVICE,
  FileStorageService,
} from './storage/storage.interface';

import { LocalStorageService } from './storage/local-storage.service';
import { S3StorageService } from './storage/s3-storage.service';
import { createStorageKey } from './storage/storage-key';

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
    private readonly cleanup: AttachmentCleanupService,
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

    return this.store(file, file.buffer, visit, (metadata) =>
      this.fileRepository.create({ visitId: visit.id, ...metadata }),
    );
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

    try {
      return await this.fileRepository.deleteById(id);
    } catch (error) {
      this.throwIfMissing(error);
      throw error;
    }
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

    try {
      return await this.store(file, file.buffer, visit, (metadata) =>
        this.fileRepository.updateById(id, metadata),
      );
    } catch (error) {
      this.throwIfMissing(error);
      throw error;
    }
  }

  private async store<T>(
    file: UploadedFilePayload,
    buffer: Buffer,
    visit: { id: string; userId: string },
    persist: (metadata: {
      storedName: string;
      relativePath: string;
      originalName: string;
      mimeType: string;
      size: number;
      storageProvider: string;
    }) => Promise<T>,
  ): Promise<T> {
    const stored = createStorageKey(visit.userId, visit.id, file.originalname);
    const storageProvider = this.configService.get<string>('FILE_STORAGE', 'local');
    return this.cleanup.trackWrite(storageProvider, stored.relativePath, async () => {
      await this.storageService.save({
        buffer,
        relativePath: stored.relativePath,
        mimeType: file.mimetype,
      });
      return persist({
        ...stored,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storageProvider,
      });
    });
  }

  private throwIfMissing(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new NotFoundException('文件不存在');
    }
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
