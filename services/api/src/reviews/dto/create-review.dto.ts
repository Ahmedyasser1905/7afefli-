// services/api/src/reviews/dto/create-review.dto.ts

import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  Max,
  MaxLength,
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
  @MaxLength(1000, { message: 'Le commentaire ne peut pas dépasser 1000 caractères.' })
  comment?: string;
}
