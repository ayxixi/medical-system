import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { trimOptionalString, trimString } from '../../../common/utils/string.util';
import { HealthReminderKind } from '../health-reminder.types';

export class CreateHealthReminderDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  userId!: string;

  @Transform(({ value }) => trimOptionalString(value))
  @IsOptional()
  @IsString()
  @MaxLength(64)
  visitId?: string;

  @IsEnum(HealthReminderKind)
  kind!: HealthReminderKind;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

  @Transform(({ value }) => trimOptionalString(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;

  @Type(() => Date)
  @IsDate()
  nextAt!: Date;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  localTime?: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  timeZone!: string;

  @IsBoolean()
  repeatDaily!: boolean;
}
