import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import {
  REQUEST_STATUSES,
  REQUEST_TYPES,
} from '../schemas/customer-request.schema';

const ALLOWED_STATUSES = [...REQUEST_STATUSES] as string[];

export class ContactDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  company?: string;
}

export class SubmitCustomerRequestDto {
  @IsIn([...REQUEST_TYPES])
  requestType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  customRequestType?: string;

  @Type(() => ContactDto)
  contact!: ContactDto;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  productName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsObject()
  specs?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  attachments?: string[];

  @IsBoolean()
  @IsIn([true], { message: 'consent must be true' })
  consent!: boolean;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  gRecaptchaToken?: string;

  /** Honeypot: real users never fill this. */
  @IsOptional()
  @IsString()
  website?: string;
}

export class UpdateRequestStatusDto {
  @IsIn(ALLOWED_STATUSES)
  status!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class AssignRequestDto {
  @IsString()
  assignedTo!: string;
}

export class AddNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  note!: string;
}

export class BulkStatusDto {
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  ids!: string[];

  @IsIn(ALLOWED_STATUSES)
  status!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class ListRequestsQueryDto {
  @IsOptional()
  @IsIn(ALLOWED_STATUSES)
  status?: string;

  @IsOptional()
  @IsIn([...REQUEST_TYPES])
  requestType?: string;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsIn(['createdAt', '-createdAt', 'updatedAt', '-updatedAt'])
  sort?: string;

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

export class RequestParamDto {
  @IsString()
  id!: string;
}
