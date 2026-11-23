import { Transform, Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, MaxLength } from 'class-validator';
import { trimOptionalString } from '../../../common/utils/string.util';

export class ListHealthLogsQueryDto {
  @Transform(({ value }) => trimOptionalString(value))
  @IsOptional()
  @IsString()
  @MaxLength(64)
  userId?: string;

  @Type(() => Date)
  @IsOptional()
  @IsDate()
  from?: Date;

  @Type(() => Date)
  @IsOptional()
  @IsDate()
  to?: Date;
}
