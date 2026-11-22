import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { trimString } from '../../../common/utils/string.util';

export class RegisterDto {
  @Transform(({ value }) => trimString(value)?.toLowerCase())
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-z0-9][a-z0-9_.-]*$/)
  username!: string;

  @Transform(({ value }) => trimString(value)?.toLowerCase())
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  inviteCode?: string;
}
