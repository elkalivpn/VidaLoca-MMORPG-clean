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

export const CASINO_CURRENCIES = ['EUR', 'VIDACOIN'] as const;
export type CasinoCurrency = (typeof CASINO_CURRENCIES)[number];

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
  @Min(1)
  @Max(100000)
  bet: number;

  @IsIn(ROULETTE_BET_TYPES)
  betType: RouletteBetType;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(36)
  number?: number;

  @IsOptional()
  @IsIn(CASINO_CURRENCIES)
  currency?: CasinoCurrency;
}

export class DiceBetDto {
  @IsNumber()
  @Min(1)
  @Max(100000)
  bet: number;

  @IsIn(DICE_CHOICES)
  choice: DiceChoice;

  @IsOptional()
  @IsIn(CASINO_CURRENCIES)
  currency?: CasinoCurrency;
}

export class BlackjackStartDto {
  @IsNumber()
  @Min(1)
  @Max(100000)
  bet: number;

  @IsOptional()
  @IsIn(CASINO_CURRENCIES)
  currency?: CasinoCurrency;
}

export class BlackjackActionDto {
  @IsString()
  @IsNotEmpty()
  handId: string;

  @IsIn(BLACKJACK_ACTIONS)
  action: BlackjackAction;
}
