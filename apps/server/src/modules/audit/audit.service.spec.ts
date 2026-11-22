import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: { auditLog: { create: jest.Mock } };

  beforeEach(() => {
    prisma = { auditLog: { create: jest.fn().mockResolvedValue({}) } };
    service = new AuditService(prisma as unknown as PrismaService);
  });

  it('persists only the audit metadata allowlist', async () => {
    await service.record({
      accountId: 'account-1', action: 'Visit.create', resourceType: 'Visit', resourceId: 'visit-1',
      method: 'POST', statusCode: 201, succeeded: true,
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({ data: {
      accountId: 'account-1', action: 'Visit.create', resourceType: 'Visit', resourceId: 'visit-1',
      method: 'POST', statusCode: 201, succeeded: true,
    } });
  });

  it('does not fail the business request or log event details when audit persistence fails', async () => {
    prisma.auditLog.create.mockRejectedValue(new Error('database error with private diagnosis'));
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    await expect(service.record({
      accountId: 'account-1', action: 'Visit.update', resourceType: 'Visit',
      method: 'PATCH', statusCode: 500, succeeded: false,
    })).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith('操作审计写入失败');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private diagnosis');
  });
});
