// services/api/src/reservations/dto/block-time.dto.spec.ts
// Validates that BlockTimeDto rejects invalid inputs correctly.

import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { BlockTimeDto } from './block-time.dto';

describe('BlockTimeDto', () => {
  const validPayload = {
    salonId: '550e8400-e29b-41d4-a716-446655440000',
    date: '2025-06-15',
    startTime: '09:00',
    endTime: '10:00',
  };

  async function validate_(dto: object) {
    return validate(plainToInstance(BlockTimeDto, dto));
  }

  it('should pass validation with a valid payload', async () => {
    const errors = await validate_(validPayload);
    expect(errors).toHaveLength(0);
  });

  it('should fail if salonId is not a UUID', async () => {
    const errors = await validate_({ ...validPayload, salonId: 'not-a-uuid' });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('salonId');
  });

  it('should fail if date is not in YYYY-MM-DD format', async () => {
    const errors = await validate_({ ...validPayload, date: '15/06/2025' });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('date');
  });

  it('should fail if startTime is not in HH:mm format', async () => {
    const errors = await validate_({ ...validPayload, startTime: '9:00 AM' });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('startTime');
  });

  it('should fail if endTime is not in HH:mm format', async () => {
    const errors = await validate_({ ...validPayload, endTime: '2200' });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('endTime');
  });

  it('should fail if any required field is missing', async () => {
    const { date: _, ...without } = validPayload;
    const errors = await validate_(without);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail if salonId is empty', async () => {
    const errors = await validate_({ ...validPayload, salonId: '' });
    expect(errors.length).toBeGreaterThan(0);
  });
});
