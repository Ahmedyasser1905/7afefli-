// services/api/src/reservations/dto/create-reservation.dto.ts

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  Matches,
  IsBoolean,
} from 'class-validator';

export class CreateReservationDto {
  @IsUUID()
  salonId!: string;

  @IsUUID()
  serviceId!: string;

  @IsUUID()
  @IsOptional()
  barberId?: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'appointmentDate must be in YYYY-MM-DD format' })
  appointmentDate!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime must be in HH:MM format' })
  startTime!: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'endTime must be in HH:MM format' })
  endTime?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  @Matches(/^(\+213|0)[567][0-9]{8}$/, { message: 'Phone number must be a valid Algerian number' })
  clientPhone?: string;

  @IsBoolean()
  @IsOptional()
  isWalkIn?: boolean;
}
