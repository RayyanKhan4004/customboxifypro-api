import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBooleanString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePackagingStyleDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageKey?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minimumOrderQuantity?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  deliveryTime?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBooleanString()
  isActive?: string;
}

export class UpdatePackagingStyleDto extends CreatePackagingStyleDto {}

export class ListPublicPackagingStylesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({
    deprecated: true,
    description: 'Ignored; packaging styles are independent of industries.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  industries?: string;
}
