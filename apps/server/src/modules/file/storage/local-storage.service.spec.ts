import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { ConfigService } from '@nestjs/config';
import { LocalStorageService } from './local-storage.service';

describe('LocalStorageService', () => {
  let root: string;
  let outside: string;
  let service: LocalStorageService;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'medical-storage-root-'));
    outside = await mkdtemp(path.join(tmpdir(), 'medical-storage-outside-'));
    service = new LocalStorageService({
      get: (_key: string, fallback?: string) => root || fallback,
    } as unknown as ConfigService);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  });

  it('saves without overwriting and reads a file stream from the upload root', async () => {
    const input = { relativePath: 'member/visit/file.txt', buffer: Buffer.from('medical text'), mimeType: 'text/plain' };
    await service.save(input);

    const stream = await service.read(input.relativePath);
    expect(stream).not.toBeNull();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString()).toBe('medical text');
    expect(await readFile(path.join(root, input.relativePath), 'utf8')).toBe('medical text');
    await expect(service.save(input)).rejects.toMatchObject({ code: 'EEXIST' });
  });

  it('returns null for missing files and refuses paths and symlinks outside the root', async () => {
    expect(await service.read('missing.txt')).toBeNull();
    const secretPath = path.join(outside, 'secret.txt');
    await writeFile(secretPath, 'keep this');
    const escapePath = path.relative(root, secretPath);
    await expect(service.read(escapePath)).resolves.toBeNull();
    await expect(service.delete('../secret.txt')).rejects.toThrow('拒绝删除上传目录之外的文件');
    await expect(readFile(secretPath, 'utf8')).resolves.toBe('keep this');

    try {
      await symlink(secretPath, path.join(root, 'escape.txt'));
      await expect(service.read('escape.txt')).resolves.toBeNull();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EPERM') throw error;
    }
  });

  it('deletes only a file inside the upload root and treats missing delete as idempotent', async () => {
    await service.save({ relativePath: 'member/file.txt', buffer: Buffer.from('x'), mimeType: 'text/plain' });
    await service.delete('member/file.txt');
    await expect(readFile(path.join(root, 'member/file.txt'))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(service.delete('member/unknown.txt')).resolves.toBeUndefined();
  });
});
