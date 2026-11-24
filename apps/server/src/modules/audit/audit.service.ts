import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEvent {
  accountId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  method: string;
  statusCode: number;
  succeeded: boolean;
}

export interface AuditCursor {
  createdAt: Date;
  id: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(event: AuditEvent): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          accountId: event.accountId,
          action: event.action,
          resourceType: event.resourceType,
          resourceId: event.resourceId,
          method: event.method,
          statusCode: event.statusCode,
          succeeded: event.succeeded,
        },
      });
    } catch {
      this.logger.warn('操作审计写入失败');
    }
  }

  async listForAccount(accountId: string, limit: number, cursor?: string) {
    const decoded = cursor ? this.decodeCursor(cursor) : undefined;
    const rows = await this.prisma.auditLog.findMany({
      where: {
        accountId,
        ...(decoded && {
          OR: [
            { createdAt: { lt: decoded.createdAt } },
            { createdAt: decoded.createdAt, id: { lt: decoded.id } },
          ],
        }),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: {
        id: true,
        createdAt: true,
        action: true,
        resourceType: true,
        resourceId: true,
        method: true,
        statusCode: true,
        succeeded: true,
      },
    });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items.at(-1);
    return {
      items,
      hasMore,
      nextCursor: hasMore && last ? this.encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
    };
  }

  private encodeCursor(cursor: AuditCursor): string {
    return Buffer.from(JSON.stringify({ createdAt: cursor.createdAt.toISOString(), id: cursor.id })).toString('base64url');
  }

  private decodeCursor(value: string): AuditCursor {
    try {
      const decoded: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
      if (!decoded || typeof decoded !== 'object') throw new Error('invalid cursor');
      const candidate = decoded as { createdAt?: unknown; id?: unknown };
      const createdAt = typeof candidate.createdAt === 'string' ? new Date(candidate.createdAt) : undefined;
      if (!createdAt || Number.isNaN(createdAt.getTime()) || typeof candidate.id !== 'string' || !candidate.id || candidate.id.length > 64) {
        throw new Error('invalid cursor');
      }
      return { createdAt, id: candidate.id };
    } catch {
      throw new BadRequestException('分页游标无效，请刷新后重试');
    }
  }
}
