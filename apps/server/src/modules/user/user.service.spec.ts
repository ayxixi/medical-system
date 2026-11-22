import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;
  let repository: {
    create: jest.Mock;
    findManyByAccount: jest.Mock;
    findByIdForAccount: jest.Mock;
    updateForAccount: jest.Mock;
    countByAccount: jest.Mock;
    deleteForAccount: jest.Mock;
  };

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findManyByAccount: jest.fn(),
      findByIdForAccount: jest.fn(),
      updateForAccount: jest.fn(),
      countByAccount: jest.fn(),
      deleteForAccount: jest.fn(),
    };
    service = new UserService(repository as unknown as UserRepository);
  });

  it('creates a member under the authenticated account', async () => {
    repository.create.mockResolvedValue({ id: 'user-1', accountId: 'account-1' });

    await expect(service.create('account-1', { name: 'Alice' })).resolves.toEqual({
      id: 'user-1',
      accountId: 'account-1',
    });
    expect(repository.create).toHaveBeenCalledWith({ accountId: 'account-1', name: 'Alice' });
  });

  it('lists only the current account members', async () => {
    repository.findManyByAccount.mockResolvedValue([{ id: 'user-1' }]);

    await expect(service.findMany('account-1')).resolves.toEqual([{ id: 'user-1' }]);
    expect(repository.findManyByAccount).toHaveBeenCalledWith('account-1');
  });

  it('returns not found when a member is outside the current account', async () => {
    repository.findByIdForAccount.mockResolvedValue(null);

    await expect(service.findById('account-1', 'foreign-user')).rejects.toThrow(NotFoundException);
    expect(repository.findByIdForAccount).toHaveBeenCalledWith('foreign-user', 'account-1');
  });

  it('returns not found when an account scoped update misses', async () => {
    repository.updateForAccount.mockResolvedValue(null);

    await expect(service.update('account-1', 'foreign-user', { name: 'Mallory' }))
      .rejects.toThrow(NotFoundException);
    expect(repository.updateForAccount).toHaveBeenCalledWith(
      'foreign-user',
      'account-1',
      { name: 'Mallory' },
    );
  });

  it('keeps the last member in an account', async () => {
    repository.findByIdForAccount.mockResolvedValue({ id: 'user-1' });
    repository.countByAccount.mockResolvedValue(1);

    await expect(service.remove('account-1', 'user-1')).rejects.toThrow(BadRequestException);
    expect(repository.deleteForAccount).not.toHaveBeenCalled();
  });

  it('deletes a member when another member remains', async () => {
    repository.findByIdForAccount.mockResolvedValue({ id: 'user-1' });
    repository.countByAccount.mockResolvedValue(2);
    repository.deleteForAccount.mockResolvedValue(true);

    await expect(service.remove('account-1', 'user-1')).resolves.toEqual({ id: 'user-1' });
    expect(repository.countByAccount).toHaveBeenCalledWith('account-1');
    expect(repository.deleteForAccount).toHaveBeenCalledWith('user-1', 'account-1');
  });

  it('does not count or delete a member that is outside the account', async () => {
    repository.findByIdForAccount.mockResolvedValue(null);

    await expect(service.remove('account-1', 'foreign-user')).rejects.toThrow(NotFoundException);
    expect(repository.countByAccount).not.toHaveBeenCalled();
    expect(repository.deleteForAccount).not.toHaveBeenCalled();
  });
});
