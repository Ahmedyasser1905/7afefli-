import { IsOptional, IsString, IsUrl, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  full_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^(\+213|0)[567][0-9]{8}$/, { message: 'Phone number must be a valid Algerian number' })
  phone_number?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  avatar_url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  wilaya?: string;
}
