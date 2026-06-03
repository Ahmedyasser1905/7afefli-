import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

const mockService = {
  create: jest.fn().mockResolvedValue({ id: '1' }),
  findBySalon: jest.fn().mockResolvedValue([]),
};

describe('ReviewsController', () => {
  let controller: ReviewsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [
        { provide: require('../supabase/supabase.service').SupabaseService, useValue: {} },
        {
          provide: ReviewsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<ReviewsController>(ReviewsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call create', async () => {
    expect(await controller.create({ reservationId: '1', rating: 5 } as any, { id: 'u1' } as any)).toEqual({ id: '1' });
  });

  it('should call findBySalon', async () => {
    expect(await controller.findBySalon('1')).toEqual([]);
  });
});
