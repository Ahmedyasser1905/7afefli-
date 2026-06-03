import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsService } from './reviews.service';
import { SupabaseService } from '../supabase/supabase.service';

const mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  then: jest.fn((resolve) => resolve({ data: [], error: null })),
};

const mockSupabaseAdminClient = {
  from: jest.fn(() => mockQueryBuilder),
};

describe('ReviewsService', () => {
  let service: ReviewsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        {
          provide: SupabaseService,
          useValue: { adminClient: mockSupabaseAdminClient },
        },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a review', async () => {
      // Mock reservation fetch
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data: { id: 'r1', client_id: 'c1', status: 'Completed', salon_id: 's1' }, error: null }));
      // Mock existing review check
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data: null, error: null }));
      // Mock insert
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data: { id: 'rev1' }, error: null }));
      
      const res = await service.create({ reservationId: 'r1', salonId: 's1', rating: 5, comment: 'Good' }, 'c1');
      expect(res.id).toBe('rev1');
    });
  });

  describe('findBySalon', () => {
    it('should find reviews by salon', async () => {
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data: [{ id: 'rev1' }], count: 1, error: null }));
      const res = await service.findBySalon('s1');
      expect(res).toEqual({ data: [{ id: 'rev1' }], total: 1, limit: 20, offset: 0 });
    });
  });
});
