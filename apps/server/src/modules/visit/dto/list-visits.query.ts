import { Transform, Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { trimOptionalString } from '../../../common/utils/string.util';

export enum VisitSortBy {
  Date = 'date',
  CreatedAt = 'createdAt',
}

export enum SortOrder {
  Asc = 'asc',
  Desc = 'desc',
}

export class ListVisitsQueryDto {
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

  @Transform(({ value }) => trimOptionalString(value))
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsEnum(VisitSortBy, { message: 'sortBy 只能为 date 或 createdAt' })
  sortBy?: VisitSortBy;

  @IsOptional()
  @IsEnum(SortOrder, { message: 'order 只能为 asc 或 desc' })
  order?: SortOrder;
}
