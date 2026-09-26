import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class BuyPropertyDto {
  @IsString()
  @IsNotEmpty()
  templateId: string;
}

export class CustomizePropertyDto {
  @IsObject()
  @IsOptional()
  customized?: Record<string, any>;
}
