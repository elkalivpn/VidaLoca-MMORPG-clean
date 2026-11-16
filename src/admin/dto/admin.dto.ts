import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class BanPlayerDto {
  @IsBoolean()
  isBanned!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

export class GrantVipDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  days?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50000)
  vidaCoins?: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  reason?: string;
}
