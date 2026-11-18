import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const STREET_COMBAT_TARGETS = ['THUG', 'ENFORCER', 'RIVAL_CAR'] as const;
export type StreetCombatTarget = (typeof STREET_COMBAT_TARGETS)[number];

export class StreetCombatDto {
  @IsIn(STREET_COMBAT_TARGETS)
  targetType: StreetCombatTarget;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  weaponUsed?: string;
}
