import {
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { AuthRepository } from './auth.repository';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto, inviteCode?: string) {
    const mode = this.configService.get<string>('REGISTRATION_MODE', 'open');
    if (mode === 'invite') {
      const codes = (this.configService.get<string>('REGISTRATION_INVITE_CODES', '') ?? '')
        .split(',').map((code) => code.trim()).filter(Boolean);
      if (!inviteCode || !codes.includes(inviteCode)) {
        throw new ForbiddenException('邀请码无效');
      }
    }
    const [existing, usernameTaken] = await Promise.all([
      this.authRepository.findAccountByEmail(registerDto.email),
      this.authRepository.findAccountByUsername(registerDto.username),
    ]);

    if (existing) {
      throw new ConflictException('邮箱已注册');
    }
    if (usernameTaken) {
      throw new ConflictException('用户名已被使用');
    }

    const passwordHash = await bcrypt.hash(registerDto.password, BCRYPT_ROUNDS);

    let account;
    try {
      account = await this.authRepository.createAccountWithFirstUser({
        email: registerDto.email,
        username: registerDto.username,
        passwordHash,
        name: registerDto.name,
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('邮箱或用户名已被使用');
      }
      throw error;
    }

    return this.buildAuthResponse(account.id, account.email, account.tokenVersion, {
      username: account.username,
      defaultUserId: account.users[0]?.id,
    });
  }

  async login(loginDto: LoginDto, clientKey: string) {
    const key = createHash('sha256').update(clientKey || 'unknown').digest('hex');
    const now = Date.now();
    const existingAttempt = await this.authRepository.findLoginAttempt(key);
    if (existingAttempt && existingAttempt.blockedUntil > BigInt(now)) {
      throw new HttpException('登录尝试过多，请稍后再试', 429);
    }

    const account = await this.authRepository.findAccountByLoginIdentifier(loginDto.identifier);

    if (!account) {
      await this.recordFailedLogin(key, existingAttempt, now);
      throw new UnauthorizedException('用户名或密码错误');
    }

    const passwordValid = await bcrypt.compare(
      loginDto.password,
      account.passwordHash,
    );

    if (!passwordValid) {
      await this.recordFailedLogin(key, existingAttempt, now);
      throw new UnauthorizedException('用户名或密码错误');
    }

    await this.authRepository.clearLoginAttempt(key);
    return this.buildAuthResponse(account.id, account.email, account.tokenVersion, { username: account.username });
  }

  async setUsername(accountId: string, username: string) {
    const existing = await this.authRepository.findAccountByUsername(username);
    if (existing && existing.id !== accountId) {
      throw new ConflictException('用户名已被使用');
    }
    try {
      const account = await this.authRepository.setUsername(accountId, username);
      return { id: account.id, email: account.email, username: account.username };
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('用户名已被使用');
      }
      throw error;
    }
  }

  async changePassword(accountId: string, dto: ChangePasswordDto) {
    const account = await this.authRepository.findAccountByIdWithCredentials(accountId);
    if (!account || !(await bcrypt.compare(dto.currentPassword, account.passwordHash))) {
      throw new UnauthorizedException('当前密码错误');
    }
    await this.authRepository.changePassword(accountId, await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS));
    return { success: true };
  }

  private async recordFailedLogin(key: string, attempt: { windowStart: bigint; count: number; blockedUntil: bigint } | null, now: number) {
    const windowMs = this.configService.get<number>('LOGIN_WINDOW_SECONDS', 900) * 1000;
    const lockoutMs = this.configService.get<number>('LOGIN_LOCKOUT_SECONDS', 900) * 1000;
    const maxAttempts = this.configService.get<number>('LOGIN_MAX_ATTEMPTS', 10);
    const inWindow = attempt && now - Number(attempt.windowStart) < windowMs;
    const count = (inWindow ? attempt.count : 0) + 1;
    await this.authRepository.saveLoginAttempt(key, {
      windowStart: BigInt(inWindow ? Number(attempt.windowStart) : now),
      count,
      blockedUntil: BigInt(count >= maxAttempts ? now + lockoutMs : 0),
    });
  }

  private buildAuthResponse(
    accountId: string,
    email: string,
    tokenVersion = 0,
    extra: { defaultUserId?: string; username?: string | null } = {},
  ) {
    const accessToken = this.jwtService.sign({
      sub: accountId,
      email,
      ver: tokenVersion,
    });

    return {
      accessToken,
      account: { id: accountId, email, username: extra.username ?? null },
      ...(extra.defaultUserId ? { defaultUserId: extra.defaultUserId } : {}),
    };
  }
}
