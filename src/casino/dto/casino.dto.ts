import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export const ROULETTE_BET_TYPES = [
  'RED',
  'BLACK',
  'GREEN',
  'EVEN',
  'ODD',
  'NUMBER',
] as const;

export type RouletteBetType = (typeof ROULETTE_BET_TYPES)[number];

export const DICE_CHOICES = ['HIGH', 'LOW', 'SEVEN'] as const;
export type DiceChoice = (typeof DICE_CHOICES)[number];

export const BLACKJACK_ACTIONS = ['HIT', 'STAND', 'DOUBLE'] as const;
export type BlackjackAction = (typeof BLACKJACK_ACTIONS)[number];

export class RouletteBetDto {
  @IsNumber()
  @Min(10)
  @Max(100000)
  bet: number;

  @IsIn(ROULETTE_BET_TYPES)
  betType: RouletteBetType;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(36)
  number?: number;
}

export class DiceBetDto {
  @IsNumber()
  @Min(10)
  @Max(100000)
  bet: number;

  @IsIn(DICE_CHOICES)
  choice: DiceChoice;
}

export class BlackjackStartDto {
  @IsNumber()
  @Min(10)
  @Max(100000)
  bet: number;
}

export class BlackjackActionDto {
  @IsString()
  @IsNotEmpty()
  handId: string;

  @IsIn(BLACKJACK_ACTIONS)
  action: BlackjackAction;
}
