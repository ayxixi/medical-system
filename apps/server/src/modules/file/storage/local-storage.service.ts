import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import {
  FileStorageService,
  SaveFileInput,
} from './storage.interface';

@Injectable()
export class LocalStorageService implements FileStorageService {
  constructor(private readonly configService: ConfigService) {}

  async save(input: SaveFileInput): Promise<void> {
    const absolutePath = path.join(this.resolveUploadRoot(), input.relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, input.buffer, { flag: 'wx' });
  }

  async read(relativePath: string) {
    try {
      const root = await fs.realpath(this.resolveUploadRoot());
      const candidate = path.resolve(root, relativePath);
      if (!candidate.startsWith(root + path.sep)) return null;
      const resolved = await fs.realpath(candidate);
      if (!resolved.startsWith(root + path.sep)) return null;
      const handle = await fs.open(resolved, 'r');
      try {
        if ((await handle.stat()).isFile()) return handle.createReadStream();
      } catch (error) {
        await handle.close();
        throw error;
      }
      await handle.close();
      return null;
    } catch (error) {
      if (['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) {
        return null;
      }
      throw error;
    }
  }

  async delete(relativePath: string): Promise<void> {
    try {
      const root = await fs.realpath(this.resolveUploadRoot());
      const candidate = path.resolve(root, relativePath);
      if (!candidate.startsWith(root + path.sep)) {
        throw new Error('拒绝删除上传目录之外的文件');
      }
      const parent = await fs.realpath(path.dirname(candidate));
      if (parent !== root && !parent.startsWith(root + path.sep)) {
        throw new Error('拒绝删除上传目录之外的文件');
      }
      await fs.unlink(path.join(parent, path.basename(candidate)));
    } catch (error) {
      if (!['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) {
        throw error;
      }
    }
  }

  private resolveUploadRoot(): string {
    const uploadPath = this.configService.get<string>('UPLOAD_PATH', './uploads');

    return path.resolve(process.cwd(), uploadPath);
  }
}
