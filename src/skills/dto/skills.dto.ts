import { IsString, IsNotEmpty, IsNumber, Min, Max, IsOptional, IsEnum } from 'class-validator';
import { SkillCategory } from '@prisma/client';

export class CreateSkillDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @Min(1)
  @Max(100)
  maxLevel: number;

  @IsEnum(SkillCategory)
  category: SkillCategory;
}

export class TrainSkillDto {
  @IsString()
  @IsNotEmpty()
  skillId: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  xpAmount?: number;
}
