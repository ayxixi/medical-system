import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AttachmentCleanupService } from './attachment-cleanup.service';
import { LocalStorageService } from './storage/local-storage.service';
import { S3StorageService } from './storage/s3-storage.service';

describe('AttachmentCleanupService', () => {
  let service: AttachmentCleanupService;
  let prisma: {
    attachmentCleanup: {
      create: jest.Mock;
      updateMany: jest.Mock;
      findMany: jest.Mock;
      deleteMany: jest.Mock;
    };
    visitFile: { findFirst: jest.Mock };
  };
  let localStorage: { delete: jest.Mock };
  let s3Storage: { delete: jest.Mock };

  beforeEach(() => {
    prisma = {
      attachmentCleanup: {
        create: jest.fn().mockResolvedValue(undefined),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      visitFile: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    localStorage = { delete: jest.fn().mockResolvedValue(undefined) };
    s3Storage = { delete: jest.fn().mockResolvedValue(undefined) };
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    service = new AttachmentCleanupService(
      prisma as unknown as PrismaService,
      localStorage as unknown as LocalStorageService,
      s3Storage as unknown as S3StorageService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registers a write before storing and removes it from the active set afterward', async () => {
    const key = { storageProvider: 'local', relativePath: 'u/v/report.pdf' };
    const task = { ...key, nextAttemptAt: 0n };
    let finishWrite!: (value: string) => void;
    const write = service.trackWrite('local', key.relativePath, () => new Promise<string>((resolve) => {
      finishWrite = resolve;
    }));

    expect(prisma.attachmentCleanup.create).toHaveBeenCalledWith({
      data: { ...key, nextAttemptAt: expect.any(BigInt) },
    });
    prisma.attachmentCleanup.findMany.mockResolvedValue([task]);
    await service.runPending();
    expect(prisma.visitFile.findFirst).not.toHaveBeenCalled();
    expect(localStorage.delete).not.toHaveBeenCalled();

    finishWrite('stored');
    await expect(write).resolves.toBe('stored');
    prisma.attachmentCleanup.findMany.mockResolvedValue([task]);
    await service.runPending();
    expect(prisma.visitFile.findFirst).toHaveBeenCalledWith({
      where: key,
      select: { id: true },
    });
    expect(localStorage.delete).toHaveBeenCalledWith(key.relativePath);
  });

  it('makes a failed write eligible for cleanup immediately and rethrows the error', async () => {
    const key = { storageProvider: 'local', relativePath: 'u/v/report.pdf' };
    const error = new Error('storage write failed');

    await expect(service.trackWrite('local', key.relativePath, async () => { throw error; }))
      .rejects.toBe(error);

    expect(prisma.attachmentCleanup.updateMany).toHaveBeenCalledWith({
      where: key,
      data: { nextAttemptAt: 0n },
    });
  });

  it('keeps a referenced object queued and delays another deletion attempt', async () => {
    const task = { storageProvider: 'local', relativePath: 'u/v/shared.pdf', nextAttemptAt: 0n };
    prisma.attachmentCleanup.findMany.mockResolvedValue([task]);
    prisma.visitFile.findFirst.mockResolvedValue({ id: 'file-1' });

    await service.runPending();

    expect(localStorage.delete).not.toHaveBeenCalled();
    expect(prisma.attachmentCleanup.updateMany).toHaveBeenCalledWith({
      where: { storageProvider: task.storageProvider, relativePath: task.relativePath },
      data: { nextAttemptAt: expect.any(BigInt) },
    });
    expect(prisma.attachmentCleanup.deleteMany).not.toHaveBeenCalled();
  });

  it.each([
    ['local', 'local'],
    ['s3', 's3'],
  ])('deletes unreferenced %s objects and removes the completed task', async (provider, expectedStorage) => {
    const task = { storageProvider: provider, relativePath: 'u/v/report.pdf', nextAttemptAt: 0n };
    prisma.attachmentCleanup.findMany.mockResolvedValue([task]);

    await service.runPending();

    const storage = expectedStorage === 's3' ? s3Storage : localStorage;
    expect(storage.delete).toHaveBeenCalledWith(task.relativePath);
    expect(prisma.attachmentCleanup.deleteMany).toHaveBeenCalledWith({
      where: { storageProvider: provider, relativePath: task.relativePath },
    });
  });

  it('leaves a failed deletion queued for retry', async () => {
    const task = { storageProvider: 's3', relativePath: 'u/v/report.pdf', nextAttemptAt: 0n };
    prisma.attachmentCleanup.findMany.mockResolvedValue([task]);
    s3Storage.delete.mockRejectedValue(new Error('S3 unavailable'));

    await service.runPending();

    const retryUpdate = prisma.attachmentCleanup.updateMany.mock.calls[0][0];
    expect(retryUpdate.where).toEqual({
      storageProvider: task.storageProvider,
      relativePath: task.relativePath,
    });
    expect(retryUpdate.data.nextAttemptAt).toEqual(expect.any(BigInt));
    expect(retryUpdate.data.nextAttemptAt).toBeGreaterThan(BigInt(Date.now()));
    expect(prisma.attachmentCleanup.deleteMany).not.toHaveBeenCalled();
  });

  it('shares an in-flight batch between concurrent callers', async () => {
    let finishBatch!: (tasks: never[]) => void;
    prisma.attachmentCleanup.findMany.mockImplementation(() => new Promise((resolve) => {
      finishBatch = resolve;
    }));

    const first = service.runPending();
    const second = service.runPending();
    expect(second).toBe(first);
    finishBatch([]);
    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);
    expect(prisma.attachmentCleanup.findMany).toHaveBeenCalledTimes(1);
  });
});
