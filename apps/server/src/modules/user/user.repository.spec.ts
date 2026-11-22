import { PrismaService } from '../../prisma/prisma.service';
import { UserRepository } from './user.repository';

describe('UserRepository', () => {
  let repository: UserRepository;
  let prisma: {
    user: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
      updateMany: jest.Mock;
      deleteMany: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      user: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    repository = new UserRepository(prisma as unknown as PrismaService);
  });

  it('creates a user with account ownership', async () => {
    prisma.user.create.mockResolvedValue({ id: 'user-1' });

    await repository.create({ accountId: 'account-1', name: 'Alice' });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { accountId: 'account-1', name: 'Alice' },
    });
  });

  it('filters and orders the account member list', async () => {
    prisma.user.findMany.mockResolvedValue([]);

    await repository.findManyByAccount('account-1');

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { accountId: 'account-1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('scopes member lookup and count to the account', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.count.mockResolvedValue(0);

    await repository.findByIdForAccount('user-1', 'account-1');
    await repository.countByAccount('account-1');

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'user-1', accountId: 'account-1' },
    });
    expect(prisma.user.count).toHaveBeenCalledWith({ where: { accountId: 'account-1' } });
  });

  it('updates only a matching account member and returns null when missing', async () => {
    prisma.user.updateMany.mockResolvedValue({ count: 0 });

    await expect(repository.updateForAccount('user-1', 'account-1', { name: 'Alice' }))
      .resolves.toBeNull();
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1', accountId: 'account-1' },
      data: { name: 'Alice' },
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('returns the updated record after a scoped update succeeds', async () => {
    const updated = { id: 'user-1', name: 'Alice' };
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findUnique.mockResolvedValue(updated);

    await expect(repository.updateForAccount('user-1', 'account-1', { name: 'Alice' }))
      .resolves.toEqual(updated);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-1' } });
  });

  it('deletes only a matching account member and reports whether one was found', async () => {
    prisma.user.deleteMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });

    await expect(repository.deleteForAccount('user-1', 'account-1')).resolves.toBe(false);
    await expect(repository.deleteForAccount('user-1', 'account-1')).resolves.toBe(true);
    expect(prisma.user.deleteMany).toHaveBeenCalledWith({
      where: { id: 'user-1', accountId: 'account-1' },
    });
  });
});
