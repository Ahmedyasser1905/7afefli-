// services/api/src/auth/dto/verify-profile.dto.ts
// VerifyProfileDto — role field intentionally omitted to prevent privilege escalation

import { IsString, IsNotEmpty, IsOptional, Matches, MaxLength } from 'class-validator';

export class VerifyProfileDto {
  /**
   * id is intentionally excluded — we always use the authenticated user's id
   * from the JWT to prevent impersonation attacks.
   */

  @IsString()
  @IsNotEmpty()
  @Matches(/^\+213[5-7][0-9]{8}$|^0[5-7][0-9]{8}$/, {
    message: 'phoneNumber must be a valid Algerian phone number',
  })
  phoneNumber!: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  fullName?: string;

  /**
   * role is intentionally excluded — role is managed exclusively by
   * admin endpoints to prevent privilege escalation.
   */
}
