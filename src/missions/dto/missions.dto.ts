import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsPositive,
  Min,
  Max,
} from 'class-validator';
import { Difficulty, MissionStatus } from '@prisma/client';

export class CreateMissionTemplateDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(Difficulty)
  difficulty: Difficulty;

  @IsNumber()
  @IsPositive()
  rewardEuros: number;

  @IsNumber()
  @Min(0)
  rewardXp: number;

  @IsOptional()
  requirement?: Record<string, any>;
}

export class StartMissionDto {
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
