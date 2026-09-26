import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class ChatMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  message: string;

  @IsOptional()
  @IsString()
  locationId?: string;
}

export class JoinZoneDto {
  @IsString()
  @IsNotEmpty()
  locationId: string;
}
