import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';

const SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'name',
  'publishedAt',
  'featured',
] as const;
export const PRODUCT_SORT_FIELDS: readonly string[] = SORT_FIELDS;

export function isSortField(value: string): boolean {
  return SORT_FIELDS.includes(value as (typeof SORT_FIELDS)[number]);
}

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;

  @IsOptional()
  @IsString()
  @Max(400)
  shortDescription?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  categoryId!: string;

  @IsOptional()
  @IsString()
  subcategoryId?: string;

  @IsOptional()
  @IsIn(['draft', 'published', 'archived'])
  status?: 'draft' | 'published' | 'archived';

  @IsOptional()
  @IsIn(['public', 'internal', 'hidden'])
  visibility?: 'public' | 'internal' | 'hidden';

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @Max(100)
  sku?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsObject({ each: true })
  images?: Array<{ key: string; alt: string; order: number; isMain: boolean }>;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    weight?: number;
    unit?: string;
  };

  @IsOptional()
  @IsInt()
  @Min(1)
  moq?: number;

  @IsOptional()
  customizableProperties?: unknown;

  @IsOptional()
  @IsObject()
  seo?: { title?: string; description?: string; canonicalUrl?: string };
}

export class UpdateProductDto extends CreateProductDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  /** Current version; update fails with PRODUCT_VERSION_CONFLICT if it has changed. */
  version!: number;
}

export class PublicListProductQueryDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  subcategory?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  tags?: string;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeTotal?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeFacets?: boolean;

  @IsOptional()
  @IsString()
  @Max(4096)
  /** JSON array of { key, value } dynamic filter pairs, e.g. [{"key":"material","value":"kraft"}]. */
  filters?: string;
}

export class AdminListProductQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsIn(['draft', 'published', 'archived'])
  status?: string;

  @IsOptional()
  @IsIn(['public', 'internal', 'hidden'])
  visibility?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(PRODUCT_SORT_FIELDS)
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeDeleted?: boolean;
}
