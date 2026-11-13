import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsNumber,
  IsIn,
} from 'class-validator';

export type PlayerAnim = 'idle' | 'walk' | 'run' | 'drive';

export class ChatMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  message: string;

  @IsOptional()
  @IsString()
  locationId?: string;
}

export class JoinZoneDto {
  @IsString()
  @IsNotEmpty()
  locationId: string;
}

export class PlayerMoveDto {
  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsNumber()
  z: number;

  @IsNumber()
  rotY: number;

  @IsOptional()
  @IsIn(['idle', 'walk', 'run', 'drive'])
  anim?: PlayerAnim;

  @IsOptional()
  @IsString()
  vehicleId?: string;
}

