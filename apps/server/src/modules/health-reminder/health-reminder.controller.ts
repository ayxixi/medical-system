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
import { CreateHealthReminderDto } from './dto/create-health-reminder.dto';
import { HealthReminderActionDto } from './dto/health-reminder-action.dto';
import { ListHealthRemindersQueryDto } from './dto/list-health-reminders.query';
import { UpdateHealthReminderDto } from './dto/update-health-reminder.dto';
import { HealthReminderService } from './health-reminder.service';

@Controller('health-reminders')
export class HealthReminderController {
  constructor(private readonly service: HealthReminderService) {}

  @Post()
  create(@CurrentAccount() account: AuthenticatedAccount, @Body() dto: CreateHealthReminderDto) {
    return this.service.create(account.id, dto);
  }

  @Get()
  findMany(@CurrentAccount() account: AuthenticatedAccount, @Query() query: ListHealthRemindersQueryDto) {
    return this.service.findMany(account.id, query);
  }

  @Patch(':id')
  update(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
    @Body() dto: UpdateHealthReminderDto,
  ) {
    return this.service.update(account.id, id, dto);
  }

  @Post(':id/action')
  act(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
    @Body() dto: HealthReminderActionDto,
  ) {
    return this.service.act(account.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentAccount() account: AuthenticatedAccount, @Param('id') id: string) {
    await this.service.remove(account.id, id);
  }
}
