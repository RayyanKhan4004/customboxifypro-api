import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ListChatsDto {
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsIn(['open', 'resolved']) status?: 'open' | 'resolved';
  @IsOptional() @IsString() assignedTo?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class ListMessagesDto {
  @IsOptional() @IsString() before?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class SendMessageDto {
  @IsString() @MinLength(1) @MaxLength(4096) text!: string;
  @IsString() @MinLength(8) @MaxLength(128) idempotencyKey!: string;
}

export class SendTemplateDto {
  @IsString() @MinLength(1) name!: string;
  @IsString() @MinLength(8) @MaxLength(128) idempotencyKey!: string;
}

export class AddChatNoteDto {
  @IsString() @MinLength(1) @MaxLength(5000) text!: string;
}

export class AssignChatDto {
  @IsString() assignedTo!: string;
}

export class ChatStatusDto {
  @IsIn(['open', 'resolved']) status!: 'open' | 'resolved';
}
