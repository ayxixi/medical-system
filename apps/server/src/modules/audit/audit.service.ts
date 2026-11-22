import { Injectable, Logger } from '@nestjs/common';
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
}
