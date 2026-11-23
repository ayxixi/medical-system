import { Module } from '@nestjs/common';
import { HealthReminderController } from './health-reminder.controller';
import { HealthReminderRepository } from './health-reminder.repository';
import { HealthReminderService } from './health-reminder.service';

@Module({
  controllers: [HealthReminderController],
  providers: [HealthReminderService, HealthReminderRepository],
})
export class HealthReminderModule {}
