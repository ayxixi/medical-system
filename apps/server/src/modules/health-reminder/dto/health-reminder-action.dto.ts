import { IsEnum } from 'class-validator';
import { HealthReminderAction } from '../health-reminder.types';

export class HealthReminderActionDto {
  @IsEnum(HealthReminderAction)
  action!: HealthReminderAction;
}
