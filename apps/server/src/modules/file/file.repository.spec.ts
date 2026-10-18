import { PrismaService } from '../../prisma/prisma.service';
import { FileRepository } from './file.repository';

describe('FileRepository', () => {
  let repository: FileRepository;
  let prisma: {
    visit: { findFirst: jest.Mock };
    visitFile: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      delete: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      visit: {
        findFirst: jest.fn(),
      },
      visitFile: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
      },
    };

    repository = new FileRepository(prisma as unknown as PrismaService);
  });

  it('finds visit by id scoped to current account', async () => {
    prisma.visit.findFirst.mockResolvedValue({ id: 'visit-1', userId: 'user-1' });

    await expect(
      repository.findVisitByIdForAccount('visit-1', 'account-1'),
    ).resolves.toEqual({ id: 'visit-1', userId: 'user-1' });

    expect(prisma.visit.findFirst).toHaveBeenCalledWith({
      where: { id: 'visit-1', user: { accountId: 'account-1' } },
      select: { id: true, userId: true },
    });
  });

  it('creates file record with forwarded payload', async () => {
    prisma.visitFile.create.mockResolvedValue({ id: 'file-1' });

    await expect(
      repository.create({
        visitId: 'visit-1',
        originalName: 'report.pdf',
        storedName: 'stored-report.pdf',
        relativePath: 'user-1/visit-1/stored-report.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        storageProvider: 'local',
      }),
    ).resolves.toEqual({ id: 'file-1' });

    expect(prisma.visitFile.create).toHaveBeenCalledWith({
      data: {
        visitId: 'visit-1',
        originalName: 'report.pdf',
        storedName: 'stored-report.pdf',
        relativePath: 'user-1/visit-1/stored-report.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        storageProvider: 'local',
      },
    });
  });

  it('lists files by visit ordered by newest first', async () => {
    prisma.visitFile.findMany.mockResolvedValue([]);

    await repository.findManyByVisitId('visit-1');

    expect(prisma.visitFile.findMany).toHaveBeenCalledWith({
      where: { visitId: 'visit-1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('finds file by id', async () => {
    prisma.visitFile.findFirst.mockResolvedValue({ id: 'file-1' });

    await expect(repository.findById('file-1')).resolves.toEqual({ id: 'file-1' });

    expect(prisma.visitFile.findFirst).toHaveBeenCalledWith({
      where: { id: 'file-1' },
    });
  });

  it('finds file by id scoped to current account', async () => {
    prisma.visitFile.findFirst.mockResolvedValue({ id: 'file-1' });

    await expect(
      repository.findByIdForAccount('file-1', 'account-1'),
    ).resolves.toEqual({ id: 'file-1' });

    expect(prisma.visitFile.findFirst).toHaveBeenCalledWith({
      where: { id: 'file-1', visit: { user: { accountId: 'account-1' } } },
    });
  });

  it('deletes file by id', async () => {
    prisma.visitFile.delete.mockResolvedValue({ id: 'file-1' });

    await expect(repository.deleteById('file-1')).resolves.toEqual({ id: 'file-1' });

    expect(prisma.visitFile.delete).toHaveBeenCalledWith({
      where: { id: 'file-1' },
    });
  });

  it('updates file metadata by id', async () => {
    prisma.visitFile.update.mockResolvedValue({ id: 'file-1' });

    await expect(
      repository.updateById('file-1', {
        originalName: 'new-report.pdf',
        storedName: 'stored-new-report.pdf',
        relativePath: 'user-1/visit-1/stored-new-report.pdf',
        mimeType: 'application/pdf',
        size: 2048,
        storageProvider: 's3',
      }),
    ).resolves.toEqual({ id: 'file-1' });

    expect(prisma.visitFile.update).toHaveBeenCalledWith({
      where: { id: 'file-1' },
      data: {
        originalName: 'new-report.pdf',
        storedName: 'stored-new-report.pdf',
        relativePath: 'user-1/visit-1/stored-new-report.pdf',
        mimeType: 'application/pdf',
        size: 2048,
        storageProvider: 's3',
      },
    });
  });
});