import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateBulkImportDto {
  @IsIn(['draft', 'all-or-nothing'])
  mode: 'draft' | 'all-or-nothing' = 'draft';
}

export class ListBulkImportQueryDto {
  @IsOptional()
  @IsIn(['queued', 'processing', 'completed', 'failed', 'cancelled'])
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ErrorsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class ImportParamDto {
  @IsString()
  id!: string;
}
