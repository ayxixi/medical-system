import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthRepository } from '../auth.repository';
import { AuthenticatedAccount } from '../decorators/current-account.decorator';

interface JwtPayload {
  sub: string;
  email: string;
  ver: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService, private readonly authRepository: AuthRepository) {
    const secret = configService.get<string>('JWT_SECRET');

    if (!secret) {
      throw new Error('JWT_SECRET 未配置');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedAccount> {
    if (!Number.isInteger(payload.ver)) {
      throw new UnauthorizedException();
    }
    const account = await this.authRepository.findAccountById(payload.sub);
    if (!account || account.tokenVersion !== payload.ver || account.email !== payload.email) {
      throw new UnauthorizedException();
    }
    return { id: account.id, email: account.email, username: account.username, tokenVersion: account.tokenVersion };
  }
}
