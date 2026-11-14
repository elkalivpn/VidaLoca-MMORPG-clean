import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class TokenizeCardDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(80)
  cardholderName: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(13)
  @MaxLength(23)
  cardNumber: string;

  @IsInt()
  @Min(1)
  @Max(12)
  expMonth: number;

  @IsInt()
  @Min(2025)
  @Max(2050)
  expYear: number;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  billingPostalCode?: string;
}

export class StoreSensitiveRecordDto {
  @IsIn(['IDENTITY_KYC', 'RECOVERY_SECRET'])
  recordType: 'IDENTITY_KYC' | 'RECOVERY_SECRET';

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  label: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(512)
  secretValue: string;
}

export class InspectPromptDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  text: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  context?: string;
}
