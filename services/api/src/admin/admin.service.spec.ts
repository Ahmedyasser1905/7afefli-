import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { SupabaseService } from '../supabase/supabase.service';

const mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  then: jest.fn((resolve) => resolve({ data: [], error: null })),
};

const mockSupabaseAdminClient = {
  from: jest.fn(() => mockQueryBuilder),
};

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: SupabaseService,
          useValue: { adminClient: mockSupabaseAdminClient },
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPendingSalons', () => {
    it('should return pending salons', async () => {
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data: [{ id: '1' }], error: null }));
      const res = await service.getPendingSalons();
      expect(res).toEqual([{ id: '1' }]);
    });
  });

  describe('approveSalon', () => {
    it('should approve a salon', async () => {
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data: { id: '1' }, error: null }));
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data: { id: '1', is_approved: true }, error: null }));
      const res = await service.approveSalon('1', true);
      expect(res.is_approved).toBe(true);
    });
  });

  describe('getAllSalons', () => {
    it('should return all salons', async () => {
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data: [], error: null }));
      const res = await service.getAllSalons();
      expect(res).toEqual([]);
    });
  });

  describe('deleteSalon', () => {
    it('should delete a salon', async () => {
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) => resolve({ error: null }));
      const res = await service.deleteSalon('1');
      expect(res).toEqual({ success: true });
    });
  });

  describe('getStats', () => {
    it('should return stats', async () => {
      mockQueryBuilder.then.mockImplementation((resolve: any) => resolve({ count: 1, error: null }));
      const res = await service.getStats();
      expect(res).toEqual({
        totalSalons: 1,
        activeSalons: 1,
        pendingSalons: 1,
        totalUsers: 1,
        totalReservations: 1,
      });
    });
  });

  describe('exportAuditLogsCsv', () => {
    it('should export csv', async () => {
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data: [{ created_at: '2026', action: 'A', actor_id: '1', resource: 'R', ip_address: 'IP' }], error: null }));
      const res = await service.exportAuditLogsCsv();
      expect(res).toContain('"2026","A","1","R","IP"');
    });
  });

  describe('getRevenueStats', () => {
    it('should return revenue stats', async () => {
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data: [{ amount: 100 }, { amount: 50 }], error: null }));
      const res = await service.getRevenueStats();
      expect(res).toEqual({ totalRevenue: 150, totalPayments: 2 });
    });
  });
});
