import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export function getPrismaPagination(page?: number, limit?: number) {
  const pageNum = page ?? 1;
  const limitNum = limit ?? 20;
  return {
    skip: (pageNum - 1) * limitNum,
    take: limitNum,
  };
}
