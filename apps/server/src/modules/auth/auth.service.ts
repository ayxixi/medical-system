import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthRepository } from './auth.repository';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const existing = await this.authRepository.findAccountByEmail(
      registerDto.email,
    );

    if (existing) {
      throw new ConflictException('邮箱已注册');
    }

    const passwordHash = await bcrypt.hash(registerDto.password, BCRYPT_ROUNDS);

    const account = await this.authRepository.createAccountWithFirstUser({
      email: registerDto.email,
      passwordHash,
      name: registerDto.name,
    });

    return this.buildAuthResponse(account.id, account.email, {
      defaultUserId: account.users[0]?.id,
    });
  }

  async login(loginDto: LoginDto) {
    const account = await this.authRepository.findAccountByEmail(
      loginDto.email,
    );

    if (!account) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    const passwordValid = await bcrypt.compare(
      loginDto.password,
      account.passwordHash,
    );

    if (!passwordValid) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    return this.buildAuthResponse(account.id, account.email);
  }

  private buildAuthResponse(
    accountId: string,
    email: string,
    extra: { defaultUserId?: string } = {},
  ) {
    const accessToken = this.jwtService.sign({ sub: accountId, email });

    return {
      accessToken,
      account: { id: accountId, email },
      ...(extra.defaultUserId ? { defaultUserId: extra.defaultUserId } : {}),
    };
  }
}
