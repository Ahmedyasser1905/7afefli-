import { Test, TestingModule } from '@nestjs/testing';
import { SlotsService } from './slots.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { SupabaseService } from '../supabase/supabase.service';
import { BadRequestException } from '@nestjs/common';

const mockCacheManager = {
  get: jest.fn(),
  set: jest.fn(),
};

const mockSupabaseAdminClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  single: jest.fn(),
  then: jest.fn(),
};

describe('SlotsService', () => {
  let service: SlotsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlotsService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        {
          provide: SupabaseService,
          useValue: { adminClient: mockSupabaseAdminClient },
        },
      ],
    }).compile();

    service = module.get<SlotsService>(SlotsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAvailableSlots', () => {
    it('should return cached slots if available', async () => {
      mockCacheManager.get.mockResolvedValueOnce([{ startTime: '10:00', endTime: '10:30', isAvailable: true }]);
      const slots = await service.getAvailableSlots('salon1', 'service1', '2025-01-01');
      expect(slots.length).toBe(1);
      expect(mockCacheManager.get).toHaveBeenCalledWith('slots:salon1:service1:2025-01-01:any');
    });

    it('should calculate available slots when not cached', async () => {
      mockCacheManager.get.mockResolvedValueOnce(null);
      
      mockSupabaseAdminClient.single.mockResolvedValueOnce({
        data: { duration_minutes: 30 },
        error: null,
      });

      mockSupabaseAdminClient.single.mockResolvedValueOnce({
        data: { open_time: '09:00:00', close_time: '10:00:00', working_days: [0, 1, 2, 3, 4, 5, 6] },
        error: null,
      });

      // Mock the reservations query
      mockSupabaseAdminClient.in.mockResolvedValueOnce({
        data: [{ start_time: '09:00', end_time: '09:30' }],
        error: null,
      });

      // 2025-01-01 is a Wednesday (day 3), so it is working day
      const slots = await service.getAvailableSlots('salon1', 'service1', '2025-01-01');

      expect(slots).toEqual([
        { startTime: '09:00', endTime: '09:30', isAvailable: false },
        { startTime: '09:30', endTime: '10:00', isAvailable: true }
      ]);
    });

    it('should throw BadRequest if service not found', async () => {
      mockCacheManager.get.mockResolvedValueOnce(null);
      mockSupabaseAdminClient.single.mockResolvedValueOnce({ data: null, error: new Error() });
      mockSupabaseAdminClient.single.mockResolvedValueOnce({ data: null, error: new Error() });

      await expect(service.getAvailableSlots('1', '2', '2025-01-01')).rejects.toThrow(BadRequestException);
    });
  });
});
