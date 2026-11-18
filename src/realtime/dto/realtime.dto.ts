import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsNumber,
  IsIn,
  IsBoolean,
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

  @IsOptional()
  @IsString()
  @MaxLength(32)
  vehicleClass?: string;

  @IsOptional()
  @IsBoolean()
  isDrifting?: boolean;
}

export class CombatFireDto {
  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsNumber()
  z: number;

  @IsNumber()
  dirX: number;

  @IsNumber()
  dirZ: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  weaponType?: string;
}

export class CombatPvpHitDto {
  @IsString()
  @IsNotEmpty()
  targetPlayerId: string;

  @IsIn(['SHOT', 'MELEE'])
  attackType: 'SHOT' | 'MELEE';

  @IsOptional()
  @IsString()
  @MaxLength(32)
  weaponType?: string;
}
