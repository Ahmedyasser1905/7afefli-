// services/api/src/reviews/dto/create-review.dto.ts

import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  Max,
} from 'class-validator';

export class CreateReviewDto {
  @IsUUID()
  reservationId!: string;

  @IsUUID()
  salonId!: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsString()
  @IsOptional()
  comment?: string;
}
