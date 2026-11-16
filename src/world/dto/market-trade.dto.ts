import { IsIn, IsInt, Max, Min } from 'class-validator';

export const MARKET_GOOD_IDS = [
  'relojes_lujo',
  'tech_chips',
  'aceite_gourmet',
  'piezas_tuning',
] as const;

export type MarketGoodId = (typeof MARKET_GOOD_IDS)[number];

export class MarketTradeDto {
  @IsIn(MARKET_GOOD_IDS)
  goodId: MarketGoodId;

  @IsIn(['BUY', 'SELL'])
  action: 'BUY' | 'SELL';

  @IsInt()
  @Min(1)
  @Max(1000)
  quantity: number;
}
