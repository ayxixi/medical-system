import type { Request } from 'express';
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put, Req } from '@nestjs/common';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AuthService } from './auth.service';
import {
  AuthenticatedAccount,
  CurrentAccount,
} from './decorators/current-account.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SetUsernameDto } from './dto/set-username.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto, registerDto.inviteCode);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() loginDto: LoginDto, @Req() request: Request) {
    return this.authService.login(loginDto, request.ip ?? 'unknown');
  }

  @Post('change-password')
  changePassword(
    @CurrentAccount() account: AuthenticatedAccount,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(account.id, dto);
  }

  @Put('username')
  setUsername(@CurrentAccount() account: AuthenticatedAccount, @Body() dto: SetUsernameDto) {
    return this.authService.setUsername(account.id, dto.username);
  }

  @Get('me')
  me(@CurrentAccount() account: AuthenticatedAccount) {
    return account;
  }
}
