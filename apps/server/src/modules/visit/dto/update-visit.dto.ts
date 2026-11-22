import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { trimOptionalString } from '../../../common/utils/string.util';

export class UpdateVisitDto {
  @Type(() => Date)
  @IsOptional()
  @IsDate()
  date?: Date;

  @Transform(({ value }) => trimOptionalString(value))
  @IsOptional()
  @IsString()
  @MaxLength(200)
  hospital?: string | null;

  @Transform(({ value }) => trimOptionalString(value))
  @IsOptional()
  @IsString()
  @MaxLength(200)
  department?: string | null;

  @Transform(({ value }) => trimOptionalString(value))
  @IsOptional()
  @IsString()
  @MaxLength(200)
  doctor?: string | null;

  @Transform(({ value }) => trimOptionalString(value))
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}
