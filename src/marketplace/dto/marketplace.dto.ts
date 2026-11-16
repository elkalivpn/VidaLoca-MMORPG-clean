import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateListingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  inventoryItemId: string;

  @IsInt()
  @Min(1)
  @Max(100)
  quantity: number;

  @IsNumber()
  @Min(10)
  @Max(50_000_000)
  priceEuros: number;
}

export class BuyVipItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  offerId: string;
}
