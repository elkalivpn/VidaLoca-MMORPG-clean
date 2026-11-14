import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsPositive,
  IsBoolean,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Difficulty, MissionMode } from '@prisma/client';

export class CreateMissionTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description: string;

  @IsEnum(Difficulty)
  difficulty: Difficulty;

  @IsOptional()
  @IsEnum(MissionMode)
  mode?: MissionMode;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  city?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  minLevel?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  minPlayers?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  maxPlayers?: number;

  @IsOptional()
  @IsBoolean()
  isOptional?: boolean;

  @IsOptional()
  @IsBoolean()
  isRepeatable?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(720)
  cooldownHours?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  requiredSteps?: number;

  @IsNumber()
  @IsPositive()
  @Max(500000)
  rewardEuros: number;

  @IsNumber()
  @Min(0)
  @Max(500000)
  rewardXp: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  rewardVidaCoins?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5000)
  rewardReputation?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  rewardItemName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  unlockBenefit?: string;

  @IsOptional()
  requirement?: Record<string, unknown>;
}

export class StartMissionDto {
  @IsString()
  @IsNotEmpty()
  templateId: string;
}

export class CreateCoopMissionDto {
  @IsString()
  @IsNotEmpty()
  templateId: string;
}

export class JoinCoopMissionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  squadCode: string;
}

export class SkipMissionDto {
  @IsString()
  @IsNotEmpty()
  templateId: string;
}

export class UpdateMissionProgressDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  progress: number;
}

export class CompleteMissionDto {
  @IsString()
  @IsNotEmpty()
  missionId: string;
}
