import { Test, TestingModule } from '@nestjs/testing';
import { SalonServicesService } from './salon-services.service';
import { SupabaseService } from '../supabase/supabase.service';

const mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  then: jest.fn((resolve) => resolve({ data: [], error: null })),
};

const mockSupabaseAdminClient = {
  from: jest.fn(() => mockQueryBuilder),
};

describe('SalonServicesService', () => {
  let service: SalonServicesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalonServicesService,
        {
          provide: SupabaseService,
          useValue: { adminClient: mockSupabaseAdminClient },
        },
      ],
    }).compile();

    service = module.get<SalonServicesService>(SalonServicesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findBySalon', () => {
    it('should find services by salon', async () => {
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data: [{ id: 's1' }], error: null }));
      const res = await service.findBySalon('1');
      expect(res).toEqual([{ id: 's1' }]);
    });
  });

  describe('create', () => {
    it('should create a service', async () => {
      // Mock ownership verification
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data: { owner_id: 'u1' }, error: null }));
      // Mock insert
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data: { id: 's1' }, error: null }));
      
      const res = await service.create('1', { service_name: 'Cut', price: 10, duration_minutes: 30 } as any, 'u1');
      expect(res.id).toEqual('s1');
    });
  });

  describe('update', () => {
    it('should update a service', async () => {
      // Mock ownership verification
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data: { owner_id: 'u1' }, error: null }));
      // Mock update
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data: { id: 's1' }, error: null }));
      
      const res = await service.update('1', 's1', { price: 20 } as any, 'u1');
      expect(res.id).toEqual('s1');
    });
  });

  describe('deactivate', () => {
    it('should deactivate a service', async () => {
      // Mock ownership verification
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data: { owner_id: 'u1' }, error: null }));
      // Mock update
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data: { id: 's1' }, error: null }));
      
      const res = await service.deactivate('1', 's1', 'u1');
      expect(res.message).toEqual('Service deactivated successfully');
    });
  });
});
