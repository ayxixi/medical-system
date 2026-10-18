import { PrismaService } from '../../prisma/prisma.service';
import { MedicationRepository } from './medication.repository';

describe('MedicationRepository', () => {
  let repository: MedicationRepository;
  let prisma: {
    visit: { findFirst: jest.Mock };
    medication: {
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
      visit: {
        findFirst: jest.fn(),
      },
      medication: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    repository = new MedicationRepository(prisma as unknown as PrismaService);
  });

  it('returns true when visit exists for account', async () => {
    prisma.visit.findFirst.mockResolvedValue({ id: 'visit-1' });

    await expect(
      repository.visitExistsForAccount('visit-1', 'account-1'),
    ).resolves.toBe(true);

    expect(prisma.visit.findFirst).toHaveBeenCalledWith({
      where: { id: 'visit-1', user: { accountId: 'account-1' } },
      select: { id: true },
    });
  });

  it('creates medication with forwarded payload', async () => {
    prisma.medication.create.mockResolvedValue({ id: 'medication-1' });

    await expect(
      repository.create({
        visitId: 'visit-1',
        name: '阿司匹林',
        dosage: '100mg',
        frequency: '每日一次',
        duration: '7天',
      }),
    ).resolves.toEqual({ id: 'medication-1' });

    expect(prisma.medication.create).toHaveBeenCalledWith({
      data: {
        visitId: 'visit-1',
        name: '阿司匹林',
        dosage: '100mg',
        frequency: '每日一次',
        duration: '7天',
      },
    });
  });

  it('lists medications by visit ordered by newest first', async () => {
    prisma.medication.findMany.mockResolvedValue([]);

    await repository.findManyByVisitId('visit-1');

    expect(prisma.medication.findMany).toHaveBeenCalledWith({
      where: { visitId: 'visit-1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('finds medication by id scoped to account', async () => {
    prisma.medication.findFirst.mockResolvedValue({ id: 'medication-1' });

    await expect(
      repository.findByIdForAccount('medication-1', 'account-1'),
    ).resolves.toEqual({ id: 'medication-1' });

    expect(prisma.medication.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'medication-1',
        visit: { user: { accountId: 'account-1' } },
      },
    });
  });

  it('returns null when updateForAccount does not match current account', async () => {
    prisma.medication.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repository.updateForAccount('medication-1', 'account-1', {
        name: '氯吡格雷',
      }),
    ).resolves.toBeNull();

    expect(prisma.medication.findUnique).not.toHaveBeenCalled();
  });

  it('returns updated medication when updateForAccount succeeds', async () => {
    prisma.medication.updateMany.mockResolvedValue({ count: 1 });
    prisma.medication.findUnique.mockResolvedValue({ id: 'medication-1' });

    await expect(
      repository.updateForAccount('medication-1', 'account-1', {
        name: '氯吡格雷',
        dosage: '75mg',
      }),
    ).resolves.toEqual({ id: 'medication-1' });

    expect(prisma.medication.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'medication-1',
        visit: { user: { accountId: 'account-1' } },
      },
      data: {
        name: '氯吡格雷',
        dosage: '75mg',
      },
    });
    expect(prisma.medication.findUnique).toHaveBeenCalledWith({
      where: { id: 'medication-1' },
    });
  });

  it('returns false when deleteForAccount does not match current account', async () => {
    prisma.medication.deleteMany.mockResolvedValue({ count: 0 });

    await expect(
      repository.deleteForAccount('medication-1', 'account-1'),
    ).resolves.toBe(false);
  });

  it('returns true when deleteForAccount succeeds', async () => {
    prisma.medication.deleteMany.mockResolvedValue({ count: 1 });

    await expect(
      repository.deleteForAccount('medication-1', 'account-1'),
    ).resolves.toBe(true);

    expect(prisma.medication.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'medication-1',
        visit: { user: { accountId: 'account-1' } },
      },
    });
  });
});