import { Transform } from "class-transformer";
import { IsString, Matches, MaxLength, MinLength } from "class-validator";
import { trimString } from "../../../common/utils/string.util";

export class SetUsernameDto {
  @Transform(({ value }) => trimString(value)?.toLowerCase())
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-z0-9][a-z0-9_.-]*$/)
  username!: string;
}
