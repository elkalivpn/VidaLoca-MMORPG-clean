import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsBoolean,
} from 'class-validator';

export class BuyVehicleDto {
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsIn(['EUR', 'VIDACOIN'])
  currency?: 'EUR' | 'VIDACOIN';
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
