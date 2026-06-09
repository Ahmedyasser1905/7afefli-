// services/api/src/salon-services/dto/create-service.dto.ts

import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty()
  service_name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  @Max(100000)
  price!: number;

  @IsNumber()
  @Min(5)
  @Max(480)
  duration_minutes!: number;
}
