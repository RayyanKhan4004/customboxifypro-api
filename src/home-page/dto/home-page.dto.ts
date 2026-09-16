import { IsDateString, IsIn, IsString, MaxLength, ValidateIf } from 'class-validator';

export class UpdateHomePageDto {
  @IsIn(['home', 'countdown']) pageMode!: 'home' | 'countdown';
  @ValidateIf((dto: UpdateHomePageDto) => dto.pageMode === 'countdown' || dto.countdownTargetDate !== undefined)
  @IsDateString()
  countdownTargetDate?: string;
  @IsString() @MaxLength(80) eyebrow!: string;
  @IsString() @MaxLength(160) title!: string;
  @IsString() @MaxLength(80) titleAccent!: string;
  @IsString() @MaxLength(500) description!: string;
  @IsString() @MaxLength(40) primaryCtaLabel!: string;
  @IsString() @MaxLength(240) primaryCtaHref!: string;
  @IsString() @MaxLength(40) secondaryCtaLabel!: string;
  @IsString() @MaxLength(240) secondaryCtaHref!: string;
  @IsString() @MaxLength(24) customersValue!: string;
  @IsString() @MaxLength(24) satisfactionValue!: string;
}
