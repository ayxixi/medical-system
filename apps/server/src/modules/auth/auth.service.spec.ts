import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let authRepository: {
    findAccountByEmail: jest.Mock;
    findAccountByUsername: jest.Mock;
    findAccountByLoginIdentifier: jest.Mock;
    setUsername: jest.Mock;
    createAccountWithFirstUser: jest.Mock;
    findLoginAttempt: jest.Mock;
    saveLoginAttempt: jest.Mock;
    clearLoginAttempt: jest.Mock;
    findAccountByIdWithCredentials: jest.Mock;
    changePassword: jest.Mock;
  };
  let configValues: Record<string, unknown>;
  let jwtService: {
    sign: jest.Mock;
  };

  beforeEach(() => {
    authRepository = {
      findAccountByEmail: jest.fn(),
      findAccountByUsername: jest.fn().mockResolvedValue(null),
      findAccountByLoginIdentifier: jest.fn(),
      setUsername: jest.fn(),
      createAccountWithFirstUser: jest.fn(),
      findLoginAttempt: jest.fn().mockResolvedValue(null),
      saveLoginAttempt: jest.fn(),
      clearLoginAttempt: jest.fn(),
      findAccountByIdWithCredentials: jest.fn(),
      changePassword: jest.fn(),
    };

    configValues = {};
    jwtService = {
      sign: jest.fn().mockReturnValue('signed-token'),
    };

    service = new AuthService(
      authRepository as unknown as AuthRepository,
      jwtService as unknown as JwtService,
      { get: (key: string, fallback?: unknown) => configValues[key] ?? (key === 'LOGIN_MAX_ATTEMPTS' ? 3 : fallback) } as unknown as ConfigService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects register when email already exists', async () => {
    authRepository.findAccountByEmail.mockResolvedValue({ id: 'account-1' });

    await expect(
      service.register({
        username: 'alice',
        email: 'alice@example.com',
        password: 'hunter2hunter2',
        name: 'Alice',
      }),
    ).rejects.toThrow(ConflictException);

    expect(authRepository.createAccountWithFirstUser).not.toHaveBeenCalled();
  });

  it('registers account, hashes password and returns token with default user id', async () => {
    authRepository.findAccountByEmail.mockResolvedValue(null);
    authRepository.findAccountByUsername.mockResolvedValue(null);
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed-password' as never);
    authRepository.createAccountWithFirstUser.mockResolvedValue({
      id: 'account-1',
      email: 'alice@example.com',
      username: 'alice',
      tokenVersion: 0,
      users: [{ id: 'user-1', name: 'Alice' }],
    });

    const result = await service.register({
      username: 'alice',
      email: 'alice@example.com',
      password: 'hunter2hunter2',
      name: 'Alice',
    });

    expect(bcrypt.hash).toHaveBeenCalledWith('hunter2hunter2', 10);
    expect(authRepository.createAccountWithFirstUser).toHaveBeenCalledWith({
      email: 'alice@example.com',
      username: 'alice',
      passwordHash: 'hashed-password',
      name: 'Alice',
    });
    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: 'account-1',
      email: 'alice@example.com',
      ver: 0,
    });
    expect(result).toEqual({
      accessToken: 'signed-token',
      account: { id: 'account-1', email: 'alice@example.com', username: 'alice' },
      defaultUserId: 'user-1',
    });
  });

  it('rejects login when account does not exist', async () => {
    authRepository.findAccountByLoginIdentifier.mockResolvedValue(null);

    await expect(
      service.login({
        identifier: 'alice',
        password: 'wrong-password',
      }, 'client-1'),
    ).rejects.toThrow(UnauthorizedException);

    expect(jwtService.sign).not.toHaveBeenCalled();
  });

  it('rejects login when password is invalid', async () => {
    authRepository.findAccountByLoginIdentifier.mockResolvedValue({
      id: 'account-1',
      email: 'alice@example.com',
      username: 'alice',
      passwordHash: 'hashed-password',
      tokenVersion: 0,
    });
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

    await expect(
      service.login({
        identifier: 'alice',
        password: 'wrong-password',
      }, 'client-1'),
    ).rejects.toThrow('用户名或密码错误');

    expect(jwtService.sign).not.toHaveBeenCalled();
  });

  it('returns token on successful login', async () => {
    authRepository.findAccountByLoginIdentifier.mockResolvedValue({
      id: 'account-1',
      email: 'alice@example.com',
      username: 'alice',
      passwordHash: 'hashed-password',
      tokenVersion: 0,
    });
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

    const result = await service.login({
      identifier: 'alice',
      password: 'hunter2hunter2',
    }, 'client-1');

    expect(bcrypt.compare).toHaveBeenCalledWith(
      'hunter2hunter2',
      'hashed-password',
    );
    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: 'account-1',
      email: 'alice@example.com',
      ver: 0,
    });
    expect(result).toEqual({
      accessToken: 'signed-token',
      account: { id: 'account-1', email: 'alice@example.com', username: 'alice' },
    });
  });

  it('rejects registration when username is taken', async () => {
    authRepository.findAccountByEmail.mockResolvedValue(null);
    authRepository.findAccountByUsername.mockResolvedValue({ id: 'account-2' });
    await expect(service.register({
      username: 'alice', email: 'alice@example.com', password: 'hunter2hunter2', name: 'Alice',
    })).rejects.toThrow('用户名已被使用');
  });

  it('sets a username for a legacy account', async () => {
    authRepository.setUsername.mockResolvedValue({ id: 'account-1', email: 'alice@example.com', username: 'alice' });
    await expect(service.setUsername('account-1', 'alice')).resolves.toEqual({
      id: 'account-1', email: 'alice@example.com', username: 'alice',
    });
  });
});
