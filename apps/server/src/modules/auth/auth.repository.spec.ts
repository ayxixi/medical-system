import { PrismaService } from '../../prisma/prisma.service';
import { AuthRepository } from './auth.repository';

describe('AuthRepository', () => {
  let repository: AuthRepository;
  let prisma: {
    loginAttempt: { findUnique: jest.Mock; upsert: jest.Mock; deleteMany: jest.Mock };
    account: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      loginAttempt: { findUnique: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
      account: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    repository = new AuthRepository(prisma as unknown as PrismaService);
  });

  it('finds account by email', async () => {
    prisma.account.findUnique.mockResolvedValue({ id: 'account-1' });

    await expect(
      repository.findAccountByEmail('alice@example.com'),
    ).resolves.toEqual({ id: 'account-1' });

    expect(prisma.account.findUnique).toHaveBeenCalledWith({
      where: { email: 'alice@example.com' },
    });
  });

  it('finds account by id with narrowed select fields', async () => {
    const createdAt = new Date('2026-05-01T00:00:00.000Z');
    prisma.account.findUnique.mockResolvedValue({
      id: 'account-1',
      email: 'alice@example.com',
      createdAt,
    });

    await expect(repository.findAccountById('account-1')).resolves.toEqual({
      id: 'account-1',
      email: 'alice@example.com',
      createdAt,
    });

    expect(prisma.account.findUnique).toHaveBeenCalledWith({
      where: { id: 'account-1' },
      select: { id: true, email: true, createdAt: true, tokenVersion: true },
    });
  });

  it('creates account with first user in a single write', async () => {
    prisma.account.create.mockResolvedValue({ id: 'account-1' });

    await expect(
      repository.createAccountWithFirstUser({
        email: 'alice@example.com',
        passwordHash: 'hashed-password',
        name: 'Alice',
      }),
    ).resolves.toEqual({ id: 'account-1' });

    expect(prisma.account.create).toHaveBeenCalledWith({
      data: {
        email: 'alice@example.com',
        passwordHash: 'hashed-password',
        users: {
          create: { name: 'Alice' },
        },
      },
      include: {
        users: true,
      },
    });
  });
});