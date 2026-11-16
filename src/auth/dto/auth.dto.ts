import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(160)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message: 'El username solo puede contener letras, números, _, . o -',
  })
  username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'La contraseña debe incluir al menos una letra y un número',
  })
  password: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(32)
  displayName: string;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  referralCode?: string;
}

export class GuestLoginDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  referralCode?: string;
}

export class ConvertGuestDto {
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(160)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message: 'El username solo puede contener letras, números, _, . o -',
  })
  username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'La contraseña debe incluir al menos una letra y un número',
  })
  password: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  displayName?: string;
}

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(160)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  password: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  refreshToken: string;
}
