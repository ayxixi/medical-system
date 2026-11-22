import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'node:stream';
import * as path from 'node:path';
import {
  FileStorageService,
  SaveFileInput,
  StoredFileDescriptor,
} from './storage.interface';

@Injectable()
export class S3StorageService implements FileStorageService, OnModuleDestroy {
  private cachedClient: S3Client | undefined;

  constructor(private readonly configService: ConfigService) {}

  async save(input: SaveFileInput): Promise<StoredFileDescriptor> {
    const safeUserId = this.sanitizePathSegment(input.userId);
    const safeVisitId = this.sanitizePathSegment(input.visitId);
    const storedName = this.buildStoredName(input.originalName);
    const relativePath = path.posix.join(safeUserId, safeVisitId, storedName);

    const client = this.getClient();
    const bucket = this.getRequiredConfig('S3_BUCKET');

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: relativePath,
        Body: input.buffer,
        ContentType: input.mimeType,
      }),
    );

    return { storedName, relativePath };
  }

  async read(relativePath: string) {
    try {
      const { Body } = await this.getClient().send(new GetObjectCommand({
        Bucket: this.getRequiredConfig('S3_BUCKET'),
        Key: relativePath,
      }));
      if (!(Body instanceof Readable)) throw new Error('S3 未返回可读文件流');
      return Body;
    } catch (error) {
      if (error instanceof NoSuchKey) return null;
      throw error;
    }
  }

  async delete(relativePath: string): Promise<void> {
    if (!relativePath || relativePath.includes('..')) {
      throw new Error('拒绝删除包含不安全对象键的文件');
    }

    const client = this.getClient();
    const bucket = this.getRequiredConfig('S3_BUCKET');

    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: relativePath,
      }),
    );
  }

  onModuleDestroy(): void {
    if (this.cachedClient) {
      this.cachedClient.destroy();
      this.cachedClient = undefined;
    }
  }

  private getClient(): S3Client {
    if (this.cachedClient) {
      return this.cachedClient;
    }

    const region = this.getRequiredConfig('S3_REGION');
    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY');
    const secretAccessKey = this.configService.get<string>('S3_SECRET_KEY');
    const endpoint = this.configService.get<string>('S3_ENDPOINT');
    const forcePathStyle =
      this.configService.get<string>('S3_FORCE_PATH_STYLE') === 'true';

    this.cachedClient = new S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle,
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined,
    });

    return this.cachedClient;
  }

  private getRequiredConfig(key: string): string {
    const value = this.configService.get<string>(key);

    if (!value) {
      throw new Error(`缺少必填的 S3 配置：${key}`);
    }

    return value;
  }

  private sanitizePathSegment(value: string): string {
    return value.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  private buildStoredName(originalName: string): string {
    const extension = path.extname(originalName).toLowerCase();
    const baseName = path.basename(originalName, extension);
    const safeBaseName = baseName
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

    return `${Date.now()}-${safeBaseName || 'file'}${extension}`;
  }
}
