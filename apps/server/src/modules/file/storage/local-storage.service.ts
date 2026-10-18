import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import {
  FileStorageService,
  SaveFileInput,
  StoredFileDescriptor,
} from './storage.interface';

@Injectable()
export class LocalStorageService implements FileStorageService {
  constructor(private readonly configService: ConfigService) {}

  async save(input: SaveFileInput): Promise<StoredFileDescriptor> {
    const uploadRoot = this.resolveUploadRoot();
    const safeUserId = this.sanitizePathSegment(input.userId);
    const safeVisitId = this.sanitizePathSegment(input.visitId);
    const storedName = this.buildStoredName(input.originalName);
    const relativePath = path.posix.join(safeUserId, safeVisitId, storedName);
    const absolutePath = path.join(uploadRoot, safeUserId, safeVisitId, storedName);

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, input.buffer);

    return {
      storedName,
      relativePath,
    };
  }

  async delete(relativePath: string): Promise<void> {
    const uploadRoot = this.resolveUploadRoot();
    const normalizedRelative = relativePath.split(/[\\/]/).join(path.sep);
    const absolutePath = path.resolve(uploadRoot, normalizedRelative);

    if (!absolutePath.startsWith(uploadRoot + path.sep) && absolutePath !== uploadRoot) {
      throw new Error('拒绝删除上传目录之外的文件');
    }

    try {
      await fs.unlink(absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private resolveUploadRoot(): string {
    const uploadPath = this.configService.get<string>('UPLOAD_PATH', './uploads');

    return path.resolve(process.cwd(), uploadPath);
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
