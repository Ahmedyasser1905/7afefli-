// services/api/src/admin/dto/update-admin-salon.dto.ts
// Strict whitelist of fields an admin may update on a salon.
// Using Record<string, unknown> was a security risk — any column could be injected.

import {
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  IsArray,
  IsInt,
  Min,
  Max,
  MaxLength,
  Matches,
} from 'class-validator';

export class UpdateAdminSalonDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  wilaya?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  commune?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^(\+213|0)[567][0-9]{8}$/, { message: 'Phone number must be a valid Algerian number' })
  phone?: string;

  @IsOptional()
  @IsString()
  open_time?: string;

  @IsOptional()
  @IsString()
  close_time?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  working_days?: number[];

  /** Admin can manually toggle a salon's approval status */
  @IsOptional()
  @IsBoolean()
  is_approved?: boolean;

  /** Admin can flag a salon as sponsored */
  @IsOptional()
  @IsBoolean()
  is_sponsored?: boolean;

  /** Admin can manually close a salon */
  @IsOptional()
  @IsBoolean()
  is_manually_closed?: boolean;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;
}
