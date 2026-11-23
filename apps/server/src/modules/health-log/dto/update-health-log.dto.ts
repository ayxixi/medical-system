import { Transform, Type } from 'class-transformer';
import { IsDate, IsEnum, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { trimOptionalString } from '../../../common/utils/string.util';
import { HealthLogType } from '../health-log.types';

const trimNullableString = ({ value }: { value: unknown }) =>
  value === null ? null : trimOptionalString(value);

export class UpdateHealthLogDto {
  @IsOptional()
  @IsEnum(HealthLogType)
  type?: HealthLogType;

  @Type(() => Date)
  @IsOptional()
  @IsDate()
  occurredAt?: Date;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(25)
  @Max(45)
  temperature?: number | null;

  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  medicineName?: string | null;

  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  dosage?: string | null;

  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  symptoms?: string | null;

  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}
