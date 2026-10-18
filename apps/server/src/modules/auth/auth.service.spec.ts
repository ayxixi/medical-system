import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let authRepository: {
    findAccountByEmail: jest.Mock;
    createAccountWithFirstUser: jest.Mock;
  };
  let jwtService: {
    sign: jest.Mock;
  };

  beforeEach(() => {
    authRepository = {
      findAccountByEmail: jest.fn(),
      createAccountWithFirstUser: jest.fn(),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('signed-token'),
    };

    service = new AuthService(
      authRepository as unknown as AuthRepository,
      jwtService as unknown as JwtService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects register when email already exists', async () => {
    authRepository.findAccountByEmail.mockResolvedValue({ id: 'account-1' });

    await expect(
      service.register({
        email: 'alice@example.com',
        password: 'hunter2hunter2',
        name: 'Alice',
      }),
    ).rejects.toThrow(ConflictException);

    expect(authRepository.createAccountWithFirstUser).not.toHaveBeenCalled();
  });

  it('registers account, hashes password and returns token with default user id', async () => {
    authRepository.findAccountByEmail.mockResolvedValue(null);
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed-password' as never);
    authRepository.createAccountWithFirstUser.mockResolvedValue({
      id: 'account-1',
      email: 'alice@example.com',
      users: [{ id: 'user-1', name: 'Alice' }],
    });

    const result = await service.register({
      email: 'alice@example.com',
      password: 'hunter2hunter2',
      name: 'Alice',
    });

    expect(bcrypt.hash).toHaveBeenCalledWith('hunter2hunter2', 10);
    expect(authRepository.createAccountWithFirstUser).toHaveBeenCalledWith({
      email: 'alice@example.com',
      passwordHash: 'hashed-password',
      name: 'Alice',
    });
    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: 'account-1',
      email: 'alice@example.com',
    });
    expect(result).toEqual({
      accessToken: 'signed-token',
      account: { id: 'account-1', email: 'alice@example.com' },
      defaultUserId: 'user-1',
    });
  });

  it('rejects login when account does not exist', async () => {
    authRepository.findAccountByEmail.mockResolvedValue(null);

    await expect(
      service.login({
        email: 'alice@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toThrow(UnauthorizedException);

    expect(jwtService.sign).not.toHaveBeenCalled();
  });

  it('rejects login when password is invalid', async () => {
    authRepository.findAccountByEmail.mockResolvedValue({
      id: 'account-1',
      email: 'alice@example.com',
      passwordHash: 'hashed-password',
    });
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

    await expect(
      service.login({
        email: 'alice@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toThrow('邮箱或密码错误');

    expect(jwtService.sign).not.toHaveBeenCalled();
  });

  it('returns token on successful login', async () => {
    authRepository.findAccountByEmail.mockResolvedValue({
      id: 'account-1',
      email: 'alice@example.com',
      passwordHash: 'hashed-password',
    });
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

    const result = await service.login({
      email: 'alice@example.com',
      password: 'hunter2hunter2',
    });

    expect(bcrypt.compare).toHaveBeenCalledWith(
      'hunter2hunter2',
      'hashed-password',
    );
    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: 'account-1',
      email: 'alice@example.com',
    });
    expect(result).toEqual({
      accessToken: 'signed-token',
      account: { id: 'account-1', email: 'alice@example.com' },
    });
  });
});