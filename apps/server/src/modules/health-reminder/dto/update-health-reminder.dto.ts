import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { trimOptionalString } from '../../../common/utils/string.util';
import { HealthReminderKind } from '../health-reminder.types';

const trimNullableString = ({ value }: { value: unknown }) =>
  value === null ? null : trimOptionalString(value);

export class UpdateHealthReminderDto {
  @IsOptional()
  @IsEnum(HealthReminderKind)
  kind?: HealthReminderKind;

  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string | null;

  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;

  @Type(() => Date)
  @IsOptional()
  @IsDate()
  nextAt?: Date;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  localTime?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timeZone?: string;

  @IsOptional()
  @IsBoolean()
  repeatDaily?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
