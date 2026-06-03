import { Test, TestingModule } from '@nestjs/testing';
import { SalonsService } from './salons.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

const mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  ilike: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  then: jest.fn((resolve) => resolve({ data: [], error: null })),
};

const mockSupabaseAdminClient = {
  from: jest.fn(() => mockQueryBuilder),
  storage: {
    from: jest.fn().mockReturnThis(),
    getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'url' } }),
    upload: jest.fn().mockResolvedValue({ error: null }),
  }
};

describe('SalonsService', () => {
  let service: SalonsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalonsService,
        {
          provide: SupabaseService,
          useValue: { adminClient: mockSupabaseAdminClient },
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SalonsService>(SalonsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return empty array if no data', async () => {
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data: [], count: 0, error: null }));
      const result = await service.findAll({});
      expect(result).toEqual({ data: [], limit: 20, offset: 0, total: 0 });
    });

    it('should query with filters', async () => {
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data: [{ id: '1' }], count: 1, error: null }));
      const result = await service.findAll({ wilaya: '16', status: 'Pending' } as any);
      expect(result).toEqual({ data: [{ id: '1' }], limit: 20, offset: 0, total: 1 });
    });
  });

  describe('findOne', () => {
    it('should return a salon', async () => {
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data: { id: 'salon1' }, error: null }));
      const result = await service.findOne('salon1');
      expect(result.id).toBe('salon1');
    });
  });

  describe('create', () => {
    it('should create a salon', async () => {
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data: { id: '1' }, error: null }));
      const result = await service.create({ name: 'Salon 1' } as any, 'user1');
      expect(result.id).toBe('1');
    });
  });
  
  describe('update', () => {
    it('should update a salon', async () => {
      // Mock the initial find for ownership check
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data: { id: '1', owner_id: 'user1' }, error: null }));
      // Mock the update query
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data: { id: '1' }, error: null }));
      const result = await service.update('1', { name: 'Salon Updated' }, 'user1');
      expect(result.id).toBe('1');
    });
  });
});
