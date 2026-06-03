import { IsIn, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserRoleDto {
  @ApiProperty({ enum: ['Client', 'Coiffeur', 'Admin'] })
  @IsString()
  @IsIn(['Client', 'Coiffeur', 'Admin'])
  role: string;
}
