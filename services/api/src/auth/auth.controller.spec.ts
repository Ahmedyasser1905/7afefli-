// services/api/src/auth/auth.controller.spec.ts
// Security-focused tests for the auth controller.

import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { SupabaseService } from '../supabase/supabase.service';
import { ConflictException } from '@nestjs/common';
import { VerifyProfileDto } from './dto/verify-profile.dto';

// --------------------------------------------------------------------------
// Mock builder
// --------------------------------------------------------------------------
const mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  then: jest.fn((resolve) => resolve({ data: { id: 'user1' }, count: 0, error: null })),
};

const mockSupabaseAdminClient = {
  from: jest.fn(() => mockQueryBuilder),
  auth: {
    admin: {
      deleteUser: jest.fn().mockResolvedValue({ error: null }),
    },
  },
};

const mockUser = {
  id: 'user1',
  email: 'test@test.com',
  phone: '+213550000001',
  role: 'Client',
  accessToken: 'mock-token',
};

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------
describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: SupabaseService,
          useValue: { adminClient: mockSupabaseAdminClient },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SECURITY: Role escalation prevention
  // ─────────────────────────────────────────────────────────────────────────
  describe('verifyProfile — role escalation prevention', () => {
    it('should NEVER allow a client to become Admin via verifyProfile', async () => {
      // VerifyProfileDto does not have a role field — TypeScript prevents this
      // at compile time. At runtime, the whitelist ValidationPipe strips it.
      // We verify the upsert call does NOT include a role field.

      mockQueryBuilder.then.mockImplementationOnce((resolve) =>
        resolve({ data: { id: 'user1', role: 'Client' }, error: null }),
      );

      const dto: VerifyProfileDto = { phoneNumber: '+213550000001' };
      await controller.verifyProfile(dto, mockUser);

      // The upsert should have been called
      expect(mockQueryBuilder.upsert).toHaveBeenCalled();

      // Capture upsert argument and assert role is absent
      const upsertArg = mockQueryBuilder.upsert.mock.calls[0][0];
      expect(upsertArg).not.toHaveProperty('role');
    });

    it('should NEVER allow a client to become Coiffeur via verifyProfile', async () => {
      mockQueryBuilder.then.mockImplementationOnce((resolve) =>
        resolve({ data: { id: 'user1', role: 'Client' }, error: null }),
      );

      const dto: VerifyProfileDto = { phoneNumber: '+213550000001', fullName: 'Ahmed' };
      await controller.verifyProfile(dto, mockUser);

      const upsertArg = mockQueryBuilder.upsert.mock.calls[0][0];
      expect(upsertArg).not.toHaveProperty('role');
    });

    it('should use authenticated user id (from JWT), never from body', async () => {
      mockQueryBuilder.then.mockImplementationOnce((resolve) =>
        resolve({ data: { id: 'user1' }, error: null }),
      );

      const dto: VerifyProfileDto = { phoneNumber: '+213550000001' };
      // Even if an attacker could inject id, the controller should use user.id
      await controller.verifyProfile(dto, { ...mockUser, id: 'trusted-jwt-id' });

      const upsertArg = mockQueryBuilder.upsert.mock.calls[0][0];
      expect(upsertArg.id).toBe('trusted-jwt-id');
    });

    it('should mark phone as verified on successful upsert', async () => {
      mockQueryBuilder.then.mockImplementationOnce((resolve) =>
        resolve({ data: { id: 'user1', is_phone_verified: true }, error: null }),
      );

      const dto: VerifyProfileDto = { phoneNumber: '+213550000001' };
      await controller.verifyProfile(dto, mockUser);

      const upsertArg = mockQueryBuilder.upsert.mock.calls[0][0];
      expect(upsertArg.is_phone_verified).toBe(true);
    });

    it('should throw Error when database returns an error', async () => {
      mockQueryBuilder.then.mockImplementationOnce((resolve) =>
        resolve({ data: null, error: { message: 'DB Error' } }),
      );

      await expect(
        controller.verifyProfile({ phoneNumber: '+213550000001' }, mockUser),
      ).rejects.toThrow('Verification failed');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // deleteAccount
  // ─────────────────────────────────────────────────────────────────────────
  describe('deleteAccount', () => {
    it('should delete Client account immediately (no salon check)', async () => {
      const res = await controller.deleteAccount({ ...mockUser, role: 'Client' });
      expect(res).toEqual({ success: true });
      expect(mockSupabaseAdminClient.auth.admin.deleteUser).toHaveBeenCalledWith(mockUser.id);
    });

    it('should delete Coiffeur account when no active reservations', async () => {
      // Salons query — returns one salon
      mockQueryBuilder.then.mockImplementationOnce((resolve) =>
        resolve({ data: [{ id: 'salon1' }], error: null }),
      );
      // Reservations count query — returns 0 active
      mockQueryBuilder.then.mockImplementationOnce((resolve) =>
        resolve({ data: null, count: 0, error: null }),
      );

      const res = await controller.deleteAccount({ ...mockUser, role: 'Coiffeur' });
      expect(res).toEqual({ success: true });
    });

    it('should throw ConflictException if Coiffeur has active reservations', async () => {
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) =>
        resolve({ data: [{ id: 'salon1' }], error: null }),
      );
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) =>
        resolve({ data: null, count: 3, error: null }),
      );

      await expect(
        controller.deleteAccount({ ...mockUser, role: 'Coiffeur' }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
