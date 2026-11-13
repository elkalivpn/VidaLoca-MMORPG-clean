import { ApiProperty } from '@nestjs/swagger';
import { FactionType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class JoinFactionDto {
  @ApiProperty({ enum: FactionType, example: FactionType.POLICE })
  @IsEnum(FactionType)
  faction: FactionType;
}

export class InterceptDto {
  @ApiProperty({
    description: 'ID del jugador sospechoso a interceptar',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  suspectPlayerId: string;
}
