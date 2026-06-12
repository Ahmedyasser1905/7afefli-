// services/api/src/salons/dto/create-salon.dto.ts

import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsArray,
  Min,
  Max,
  Matches,
} from 'class-validator';

export class CreateSalonDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  wilaya!: string;

  @IsString()
  @IsNotEmpty()
  commune!: string;

  @IsString()
  @IsNotEmpty()
  address!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^(\+213|0)[567][0-9]{8}$/, { message: 'Phone number must be a valid Algerian number' })
  phone!: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}:\d{2}$/, { message: 'open_time must be in HH:MM format' })
  open_time!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}:\d{2}$/, { message: 'close_time must be in HH:MM format' })
  close_time!: string;

  @IsArray()
  @IsNotEmpty()
  @IsNumber({}, { each: true })
  working_days!: number[];
}
