import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsPositive,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';

export class BuyVehicleDto {
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @IsOptional()
  @IsString()
  color?: string;
}

export class UpdateVehicleDto {
  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class RepairVehicleDto {
  @IsString()
  @IsNotEmpty()
  vehicleId: string;
}
