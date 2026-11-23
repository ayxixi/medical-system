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
  Query,
} from '@nestjs/common';
import { AuthenticatedAccount, CurrentAccount } from '../auth/decorators/current-account.decorator';
import { CreateHealthLogDto } from './dto/create-health-log.dto';
import { ListHealthLogsQueryDto } from './dto/list-health-logs.query';
import { UpdateHealthLogDto } from './dto/update-health-log.dto';
import { HealthLogService } from './health-log.service';

@Controller('health-logs')
export class HealthLogController {
  constructor(private readonly healthLogService: HealthLogService) {}

  @Post()
  create(
    @CurrentAccount() account: AuthenticatedAccount,
    @Body() dto: CreateHealthLogDto,
  ) {
    return this.healthLogService.create(account.id, dto);
  }

  @Get()
  findMany(
    @CurrentAccount() account: AuthenticatedAccount,
    @Query() query: ListHealthLogsQueryDto,
  ) {
    return this.healthLogService.findMany(account.id, query);
  }

  @Patch(':id')
  update(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
    @Body() dto: UpdateHealthLogDto,
  ) {
    return this.healthLogService.update(account.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
  ) {
    await this.healthLogService.remove(account.id, id);
  }
}
