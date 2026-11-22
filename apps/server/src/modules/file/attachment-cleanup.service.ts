import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalStorageService } from './storage/local-storage.service';
import { S3StorageService } from './storage/s3-storage.service';

@Injectable()
export class AttachmentCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AttachmentCleanupService.name);
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;
  private readonly activeWrites = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly localStorage: LocalStorageService,
    private readonly s3Storage: S3StorageService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.runPending().catch(() => this.logger.warn('附件清理队列暂不可用，将自动重试'));
    }, 5_000);
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.timer);
    await this.running?.catch(() => undefined);
  }

  async trackWrite<T>(storageProvider: string, relativePath: string, write: () => Promise<T>): Promise<T> {
    const key = { storageProvider, relativePath };
    // An interrupted write is eligible for cleanup after a grace period.
    await this.prisma.attachmentCleanup.create({
      data: { ...key, nextAttemptAt: BigInt(Date.now() + 60 * 60_000) },
    });
    this.activeWrites.add(relativePath);
    try {
      return await write();
    } catch (error) {
      try {
        await this.prisma.attachmentCleanup.updateMany({
          where: key,
          data: { nextAttemptAt: 0n },
        });
      } catch {
        this.logger.warn('附件写入失败，已登记的清理任务将在宽限期后重试');
      }
      throw error;
    } finally {
      this.activeWrites.delete(relativePath);
    }
  }

  runPending(): Promise<void> {
    this.running ??= this.processBatch().finally(() => { this.running = undefined; });
    return this.running;
  }

  private async processBatch(): Promise<void> {
    const tasks = await this.prisma.attachmentCleanup.findMany({
      where: { nextAttemptAt: { lte: BigInt(Date.now()) } },
      orderBy: { nextAttemptAt: 'asc' },
      take: 25,
    });

    for (const { storageProvider, relativePath } of tasks) {
      if (this.activeWrites.has(relativePath)) continue;
      const key = { storageProvider, relativePath };
      const referenced = await this.prisma.visitFile.findFirst({
        where: key,
        select: { id: true },
      });
      if (referenced) {
        // Historical attachments can share an object. A later delete queues it again.
        // Keep this task pending to avoid racing the last reference's deletion.
        await this.prisma.attachmentCleanup.updateMany({
          where: key,
          data: { nextAttemptAt: BigInt(Date.now() + 60_000) },
        });
        continue;
      }

      try {
        const storage = storageProvider === 's3' ? this.s3Storage : this.localStorage;
        await storage.delete(relativePath);
      } catch {
        this.logger.warn('附件原件清理失败，将自动重试');
        await this.prisma.attachmentCleanup.updateMany({
          where: key,
          data: { nextAttemptAt: BigInt(Date.now() + 60_000) },
        });
        continue;
      }
      await this.prisma.attachmentCleanup.deleteMany({ where: key });
    }
  }
}
