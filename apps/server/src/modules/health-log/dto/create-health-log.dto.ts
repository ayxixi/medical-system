import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { trimOptionalString, trimString } from '../../../common/utils/string.util';
import { HealthLogType } from '../health-log.types';

export class CreateHealthLogDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  userId!: string;

  @IsEnum(HealthLogType)
  type!: HealthLogType;

  @Type(() => Date)
  @IsDate()
  occurredAt!: Date;

  @ValidateIf((dto: CreateHealthLogDto) => dto.type === HealthLogType.Temperature)
  @Type(() => Number)
  @IsNumber()
  @Min(25)
  @Max(45)
  temperature?: number;

  @Transform(({ value }) => trimOptionalString(value))
  @ValidateIf((dto: CreateHealthLogDto) => dto.type === HealthLogType.Medication)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  medicineName?: string;

  @Transform(({ value }) => trimOptionalString(value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  dosage?: string;

  @Transform(({ value }) => trimOptionalString(value))
  @ValidateIf((dto: CreateHealthLogDto) => dto.type === HealthLogType.Symptom)
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  symptoms?: string;

  @Transform(({ value }) => trimOptionalString(value))
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
