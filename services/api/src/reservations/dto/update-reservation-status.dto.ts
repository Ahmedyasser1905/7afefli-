// services/api/src/reservations/dto/update-reservation-status.dto.ts

import { IsString, IsIn, IsOptional } from 'class-validator';

export class UpdateReservationStatusDto {
  @IsString()
  @IsIn(['Confirmed', 'Cancelled', 'Completed'])
  status!: 'Confirmed' | 'Cancelled' | 'Completed';

  @IsString()
  @IsOptional()
  cancel_reason?: string;
}
