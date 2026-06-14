import { IsOptional, IsString, IsNumber, IsBoolean, Min } from 'class-validator';

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  duration_days?: number;

  @IsOptional()
  @IsNumber()
  @Min(-1)
  max_barbers?: number;

  @IsOptional()
  @IsNumber()
  @Min(-1)
  max_portfolio_photos?: number;

  @IsOptional()
  @IsNumber()
  @Min(-1)
  max_reservations?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
