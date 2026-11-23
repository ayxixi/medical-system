import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { trimOptionalString } from '../../../common/utils/string.util';

export class ListHealthRemindersQueryDto {
  @Transform(({ value }) => trimOptionalString(value))
  @IsOptional()
  @IsString()
  @MaxLength(64)
  userId?: string;

  @Transform(({ value }) => value === true || value === 'true')
  @IsOptional()
  @IsBoolean()
  includeInactive?: boolean;
}
