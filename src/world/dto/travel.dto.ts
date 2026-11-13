import { IsNotEmpty, IsString } from 'class-validator';

export class TravelDto {
  @IsString()
  @IsNotEmpty()
  destinationId: string;
}
