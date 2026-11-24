import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  AuthenticatedAccount,
  CurrentAccount,
} from '../auth/decorators/current-account.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  create(
    @CurrentAccount() account: AuthenticatedAccount,
    @Body() createUserDto: CreateUserDto,
  ) {
    return this.userService.create(account.id, createUserDto);
  }

  @Get()
  findMany(@CurrentAccount() account: AuthenticatedAccount) {
    return this.userService.findMany(account.id);
  }

  @Get(':id/summary')
  findHealthSummary(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
  ) {
    return this.userService.findHealthSummary(account.id, id);
  }

  @Get(':id')
  findById(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
  ) {
    return this.userService.findById(account.id, id);
  }

  @Patch(':id')
  update(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.update(account.id, id, updateUserDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
  ) {
    await this.userService.remove(account.id, id);
  }
}
