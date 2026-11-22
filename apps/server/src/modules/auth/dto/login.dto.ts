import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { trimString } from '../../../common/utils/string.util';

export class LoginDto {
  @Transform(({ value }) => trimString(value)?.toLowerCase())
  @IsString()
  @MinLength(1)
  @MaxLength(254)
  identifier!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}
