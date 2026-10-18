import 'reflect-metadata';

import { PrismaService } from '../../prisma/prisma.service';
import { SortOrder, VisitSortBy } from './dto/list-visits.query';
import { VisitRepository } from './visit.repository';

describe('VisitRepository', () => {
  let repository: VisitRepository;
  let prisma: {
    user: { findFirst: jest.Mock };
    visit: {
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
      user: {
        findFirst: jest.fn(),
      },
      visit: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    repository = new VisitRepository(prisma as unknown as PrismaService);
  });

  it('returns true when user exists for account', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });

    await expect(
      repository.userExistsForAccount('user-1', 'account-1'),
    ).resolves.toBe(true);

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'user-1', accountId: 'account-1' },
      select: { id: true },
    });
  });

  it('builds default account-scoped filters and sort when listing visits', async () => {
    const from = new Date('2026-04-01T00:00:00.000Z');
    const to = new Date('2026-04-30T23:59:59.999Z');
    prisma.visit.findMany.mockResolvedValue([]);

    await repository.findMany({
      accountId: 'account-1',
      userId: 'user-1',
      from,
      to,
    });

    expect(prisma.visit.findMany).toHaveBeenCalledWith({
      where: {
        user: { accountId: 'account-1' },
        userId: 'user-1',
        date: {
          gte: from,
          lte: to,
        },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        user: true,
        records: true,
        medications: true,
        files: true,
      },
    });
  });

  it('builds keyword query and custom sort when listing visits', async () => {
    prisma.visit.findMany.mockResolvedValue([]);

    await repository.findMany({
      accountId: 'account-1',
      q: '  心内科  ',
      sortBy: VisitSortBy.CreatedAt,
      order: SortOrder.Asc,
    });

    expect(prisma.visit.findMany).toHaveBeenCalledWith({
      where: {
        user: { accountId: 'account-1' },
        AND: [
          {
            OR: [
              { hospital: { contains: '心内科' } },
              { department: { contains: '心内科' } },
              { doctor: { contains: '心内科' } },
              { note: { contains: '心内科' } },
              { user: { is: { name: { contains: '心内科' } } } },
              { records: { some: { diagnosis: { contains: '心内科' } } } },
              { medications: { some: { name: { contains: '心内科' } } } },
            ],
          },
        ],
      },
      orderBy: [{ createdAt: 'asc' }, { date: 'asc' }],
      include: {
        user: true,
        records: true,
        medications: true,
        files: true,
      },
    });
  });

  it('returns null when updateForAccount does not match current account', async () => {
    prisma.visit.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repository.updateForAccount('visit-1', 'account-1', { note: '复诊' }),
    ).resolves.toBeNull();

    expect(prisma.visit.findUnique).not.toHaveBeenCalled();
  });

  it('returns updated visit when updateForAccount succeeds', async () => {
    prisma.visit.updateMany.mockResolvedValue({ count: 1 });
    prisma.visit.findUnique.mockResolvedValue({ id: 'visit-1' });

    await expect(
      repository.updateForAccount('visit-1', 'account-1', { note: '复诊' }),
    ).resolves.toEqual({ id: 'visit-1' });

    expect(prisma.visit.updateMany).toHaveBeenCalledWith({
      where: { id: 'visit-1', user: { accountId: 'account-1' } },
      data: { note: '复诊' },
    });
    expect(prisma.visit.findUnique).toHaveBeenCalledWith({
      where: { id: 'visit-1' },
      include: {
        user: true,
        records: true,
        medications: true,
        files: true,
      },
    });
  });
});