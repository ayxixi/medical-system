import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ExportService } from './export.service';

describe('ExportService', () => {
  let service: ExportService;
  let findUnique: jest.Mock;

  beforeEach(() => {
    findUnique = jest.fn();
    service = new ExportService(
      { account: { findUnique } } as unknown as PrismaService,
      {} as never,
    );
  });

  it('exports only the requested account and the documented medical metadata', async () => {
    const createdAt = new Date('2026-05-01T00:00:00.000Z');
    const account = {
      id: 'account-1', email: 'alice@example.com', createdAt,
      users: [{ id: 'user-1', name: 'Alice', createdAt, updatedAt: createdAt, visits: [] }],
    };
    findUnique.mockResolvedValue(account);
    const result = await service.exportAccount('account-1');

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'account-1' },
      select: expect.objectContaining({
        id: true, email: true, createdAt: true,
        users: expect.objectContaining({ select: expect.objectContaining({ visits: expect.any(Object) }) }),
      }),
    });
    const query = findUnique.mock.calls[0][0];
    expect(query.select).not.toHaveProperty('passwordHash');
    expect(query.select).not.toHaveProperty('tokenVersion');
    expect(query.select.users.select.visits.select.files.select).not.toHaveProperty('relativePath');
    expect(result).toMatchObject({
      schemaVersion: 1, account: { id: 'account-1', email: 'alice@example.com', createdAt }, users: account.users,
    });
    expect(result).toHaveProperty('exportedAt');
    expect(Number.isNaN(Date.parse(result.exportedAt))).toBe(false);
    expect(JSON.stringify(result)).not.toContain('passwordHash');
    expect(JSON.stringify(result)).not.toContain('relativePath');
  });

  it('returns not found when the account does not exist', async () => {
    findUnique.mockResolvedValue(null);
    await expect(service.exportAccount('missing-account')).rejects.toBeInstanceOf(NotFoundException);
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'missing-account' } }));
  });
});
