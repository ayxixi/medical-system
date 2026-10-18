import { PrismaService } from '../../prisma/prisma.service';
import { RecordRepository } from './record.repository';

describe('RecordRepository', () => {
  let repository: RecordRepository;
  let prisma: {
    visit: { findFirst: jest.Mock };
    diagnosisRecord: {
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
      diagnosisRecord: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    repository = new RecordRepository(prisma as unknown as PrismaService);
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

  it('creates diagnosis record with forwarded payload', async () => {
    prisma.diagnosisRecord.create.mockResolvedValue({ id: 'record-1' });

    await expect(
      repository.create({ visitId: 'visit-1', diagnosis: '高血压' }),
    ).resolves.toEqual({ id: 'record-1' });

    expect(prisma.diagnosisRecord.create).toHaveBeenCalledWith({
      data: { visitId: 'visit-1', diagnosis: '高血压' },
    });
  });

  it('lists diagnosis records by visit ordered by newest first', async () => {
    prisma.diagnosisRecord.findMany.mockResolvedValue([]);

    await repository.findManyByVisitId('visit-1');

    expect(prisma.diagnosisRecord.findMany).toHaveBeenCalledWith({
      where: { visitId: 'visit-1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('finds diagnosis record by id scoped to account', async () => {
    prisma.diagnosisRecord.findFirst.mockResolvedValue({ id: 'record-1' });

    await expect(
      repository.findByIdForAccount('record-1', 'account-1'),
    ).resolves.toEqual({ id: 'record-1' });

    expect(prisma.diagnosisRecord.findFirst).toHaveBeenCalledWith({
      where: { id: 'record-1', visit: { user: { accountId: 'account-1' } } },
    });
  });

  it('returns null when updateForAccount does not match current account', async () => {
    prisma.diagnosisRecord.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repository.updateForAccount('record-1', 'account-1', {
        diagnosis: '糖尿病',
      }),
    ).resolves.toBeNull();

    expect(prisma.diagnosisRecord.findUnique).not.toHaveBeenCalled();
  });

  it('returns updated record when updateForAccount succeeds', async () => {
    prisma.diagnosisRecord.updateMany.mockResolvedValue({ count: 1 });
    prisma.diagnosisRecord.findUnique.mockResolvedValue({ id: 'record-1' });

    await expect(
      repository.updateForAccount('record-1', 'account-1', {
        diagnosis: '糖尿病',
      }),
    ).resolves.toEqual({ id: 'record-1' });

    expect(prisma.diagnosisRecord.updateMany).toHaveBeenCalledWith({
      where: { id: 'record-1', visit: { user: { accountId: 'account-1' } } },
      data: { diagnosis: '糖尿病' },
    });
    expect(prisma.diagnosisRecord.findUnique).toHaveBeenCalledWith({
      where: { id: 'record-1' },
    });
  });

  it('returns false when deleteForAccount does not match current account', async () => {
    prisma.diagnosisRecord.deleteMany.mockResolvedValue({ count: 0 });

    await expect(
      repository.deleteForAccount('record-1', 'account-1'),
    ).resolves.toBe(false);
  });

  it('returns true when deleteForAccount succeeds', async () => {
    prisma.diagnosisRecord.deleteMany.mockResolvedValue({ count: 1 });

    await expect(
      repository.deleteForAccount('record-1', 'account-1'),
    ).resolves.toBe(true);

    expect(prisma.diagnosisRecord.deleteMany).toHaveBeenCalledWith({
      where: { id: 'record-1', visit: { user: { accountId: 'account-1' } } },
    });
  });
});