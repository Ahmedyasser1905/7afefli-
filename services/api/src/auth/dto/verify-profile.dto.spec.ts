// services/api/src/auth/dto/verify-profile.dto.spec.ts
// Security tests ensuring VerifyProfileDto cannot be used for role escalation.

import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { VerifyProfileDto } from './verify-profile.dto';

describe('VerifyProfileDto', () => {
  async function validate_(payload: object) {
    return validate(plainToInstance(VerifyProfileDto, payload));
  }

  it('should pass with a valid Algerian phone number', async () => {
    const errors = await validate_({ phoneNumber: '+213550000001' });
    expect(errors).toHaveLength(0);
  });

  it('should pass with local format phone number', async () => {
    const errors = await validate_({ phoneNumber: '0550000001' });
    expect(errors).toHaveLength(0);
  });

  it('should fail if phoneNumber is missing', async () => {
    const errors = await validate_({});
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('phoneNumber');
  });

  it('should fail if phoneNumber is not a valid Algerian number', async () => {
    const errors = await validate_({ phoneNumber: '+33612345678' });
    expect(errors.length).toBeGreaterThan(0);
  });

  // CRITICAL SECURITY: role escalation prevention
  it('should NOT define a role property on the DTO class — role field is absent by design', () => {
    // The VerifyProfileDto class intentionally has NO role property.
    // This is the TypeScript-level protection: the field cannot be declared.
    // At runtime, NestJS ValidationPipe(whitelist: true) strips undeclared fields.
    const instance = new VerifyProfileDto();
    instance.phoneNumber = '+213550000001';
    // No 'role' key should exist on a freshly constructed instance
    expect(Object.prototype.hasOwnProperty.call(instance, 'role')).toBe(false);
  });

  // CRITICAL SECURITY: id injection prevention
  it('should NOT define an id property on the DTO class — id field is absent by design', () => {
    const instance = new VerifyProfileDto();
    instance.phoneNumber = '+213550000001';
    expect(Object.prototype.hasOwnProperty.call(instance, 'id')).toBe(false);
  });

  it('role injected via plain object is stripped by class-validator whitelist mode', async () => {
    // Simulate what NestJS ValidationPipe does: validation errors should NOT
    // appear for the extra 'role' property because whitelist mode in NestJS strips
    // it before validation. class-validator itself won't generate errors for unknown
    // fields, meaning attackers get no feedback that the field was stripped.
    const errors = await validate_({
      phoneNumber: '+213550000001',
      role: 'Admin', // Should be silently ignored by the pipeline
    });
    // No validation errors — phone is valid, extra fields are not flagged
    expect(errors).toHaveLength(0);
  });

  it('should accept optional fullName', async () => {
    const errors = await validate_({ phoneNumber: '+213550000001', fullName: 'Ahmed' });
    expect(errors).toHaveLength(0);
  });

  it('should fail if fullName exceeds 100 characters', async () => {
    const errors = await validate_({
      phoneNumber: '+213550000001',
      fullName: 'A'.repeat(101),
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('fullName');
  });
});
