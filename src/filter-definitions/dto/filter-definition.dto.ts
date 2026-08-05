import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const DATA_TYPES = [
  'string',
  'number',
  'boolean',
  'enum',
  'multiselect',
] as const;

export class FilterOptionDto {
  @IsString()
  value!: string;

  @IsString()
  label!: string;
}

export class FilterValidationDto {
  @IsOptional()
  @IsNumber()
  min?: number;

  @IsOptional()
  @IsNumber()
  max?: number;

  @IsOptional()
  @IsString()
  pattern?: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class CreateFilterDefinitionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  key!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  label!: string;

  @IsIn(DATA_TYPES)
  dataType!: (typeof DATA_TYPES)[number];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryScope?: string[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FilterOptionDto)
  options?: FilterOptionDto[];

  @IsOptional()
  @IsBoolean()
  searchable?: boolean;

  @IsOptional()
  @IsBoolean()
  filterable?: boolean;

  @IsOptional()
  @IsBoolean()
  sortable?: boolean;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsBoolean()
  multiple?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => FilterValidationDto)
  validation?: FilterValidationDto;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateFilterDefinitionDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;

  @IsOptional()
  @IsIn(DATA_TYPES)
  dataType?: (typeof DATA_TYPES)[number];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryScope?: string[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FilterOptionDto)
  options?: FilterOptionDto[];

  @IsOptional()
  @IsBoolean()
  searchable?: boolean;

  @IsOptional()
  @IsBoolean()
  filterable?: boolean;

  @IsOptional()
  @IsBoolean()
  sortable?: boolean;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsBoolean()
  multiple?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => FilterValidationDto)
  validation?: FilterValidationDto;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
