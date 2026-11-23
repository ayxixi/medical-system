import 'reflect-metadata';
import { PrismaService } from '../../prisma/prisma.service';
import { HealthReminderRepository } from './health-reminder.repository';

describe('HealthReminderRepository', () => {
  let repository: HealthReminderRepository;
  let prisma: {
    user: { findFirst: jest.Mock };
    healthReminder: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      updateMany: jest.Mock;
      findUnique: jest.Mock;
      deleteMany: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      user: { findFirst: jest.fn() },
      healthReminder: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    repository = new HealthReminderRepository(prisma as unknown as PrismaService);
  });

  it('checks that the target member belongs to the current account', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });

    await expect(repository.userExistsForAccount('user-1', 'account-1')).resolves.toBe(true);
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'user-1', accountId: 'account-1' },
      select: { id: true },
    });
  });

  it('lists reminders by account and member and excludes completed rows', async () => {
    prisma.healthReminder.findMany.mockResolvedValue([]);

    await repository.findMany({ accountId: 'account-1', userId: 'user-1' });

    expect(prisma.healthReminder.findMany).toHaveBeenCalledWith({
      where: {
        user: { accountId: 'account-1', id: 'user-1' },
        completedAt: null,
        isActive: true,
      },
      orderBy: [{ isActive: 'desc' }, { nextAt: 'asc' }, { createdAt: 'asc' }],
    });
  });

  it('includes paused reminders only when requested while retaining account filters', async () => {
    prisma.healthReminder.findMany.mockResolvedValue([]);

    await repository.findMany({ accountId: 'account-1', includeInactive: true });

    expect(prisma.healthReminder.findMany).toHaveBeenCalledWith({
      where: { user: { accountId: 'account-1' }, completedAt: null },
      orderBy: [{ isActive: 'desc' }, { nextAt: 'asc' }, { createdAt: 'asc' }],
    });
  });

  it('uses the account relation when looking up a reminder', async () => {
    prisma.healthReminder.findFirst.mockResolvedValue({ id: 'reminder-1' });

    await repository.findByIdForAccount('reminder-1', 'account-1');

    expect(prisma.healthReminder.findFirst).toHaveBeenCalledWith({
      where: { id: 'reminder-1', user: { accountId: 'account-1' } },
    });
  });

  it('updates and reloads only a reminder owned by the account', async () => {
    prisma.healthReminder.updateMany.mockResolvedValue({ count: 1 });
    prisma.healthReminder.findUnique.mockResolvedValue({ id: 'reminder-1', title: '更新' });

    await expect(repository.updateForAccount('reminder-1', 'account-1', { title: '更新' }))
      .resolves.toEqual({ id: 'reminder-1', title: '更新' });
    expect(prisma.healthReminder.updateMany).toHaveBeenCalledWith({
      where: { id: 'reminder-1', user: { accountId: 'account-1' } },
      data: { title: '更新' },
    });
  });

  it('does not reload a reminder when an account-scoped update matches nothing', async () => {
    prisma.healthReminder.updateMany.mockResolvedValue({ count: 0 });

    await expect(repository.updateForAccount('reminder-1', 'account-2', { title: '更新' }))
      .resolves.toBeNull();
    expect(prisma.healthReminder.findUnique).not.toHaveBeenCalled();
  });

  it('deletes only a reminder owned by the account', async () => {
    prisma.healthReminder.deleteMany.mockResolvedValue({ count: 0 });

    await expect(repository.deleteForAccount('reminder-1', 'account-2')).resolves.toBe(false);
    expect(prisma.healthReminder.deleteMany).toHaveBeenCalledWith({
      where: { id: 'reminder-1', user: { accountId: 'account-2' } },
    });
  });
});
