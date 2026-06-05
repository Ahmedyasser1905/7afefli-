import { IsEmail, IsNotEmpty, IsString, Length, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendPasswordCodeDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  @IsNotEmpty({ message: 'L\'adresse e-mail est requise' })
  email: string;
}

export class VerifyPasswordCodeDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  @IsNotEmpty({ message: 'L\'adresse e-mail est requise' })
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6, { message: 'Le code OTP doit contenir exactement 6 chiffres' })
  @IsNotEmpty({ message: 'Le code OTP est requis' })
  code: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  @IsNotEmpty({ message: 'L\'adresse e-mail est requise' })
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6, { message: 'Le code OTP doit contenir exactement 6 chiffres' })
  @IsNotEmpty({ message: 'Le code OTP est requis' })
  code: string;

  @ApiProperty({ example: 'newPassword123' })
  @IsString()
  @MinLength(6, { message: 'Le mot de passe doit contenir au moins 6 caractères' })
  @IsNotEmpty({ message: 'Le mot de passe est requis' })
  newPassword: string;
}
