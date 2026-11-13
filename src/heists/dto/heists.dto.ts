import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export const HEIST_ROLES = ['DRIVER', 'HACKER', 'ENFORCER'] as const;
export type HeistRole = (typeof HEIST_ROLES)[number];

export class CreateHeistDto {
  @IsString()
  @IsNotEmpty()
  heistId: string;

  @IsOptional()
  @IsIn(HEIST_ROLES)
  role?: HeistRole;
}

export class JoinHeistDto {
  @IsIn(HEIST_ROLES)
  role: HeistRole;
}
