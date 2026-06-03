import { Test, TestingModule } from '@nestjs/testing';
import { SlotsController } from './slots.controller';
import { SlotsService } from './slots.service';

const mockService = {
  getAvailableSlots: jest.fn().mockResolvedValue([]),
};

describe('SlotsController', () => {
  let controller: SlotsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SlotsController],
      providers: [
        { provide: require('../supabase/supabase.service').SupabaseService, useValue: {} },
        {
          provide: SlotsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<SlotsController>(SlotsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call getAvailableSlots', async () => {
    expect(await controller.getAvailableSlots('1', '1', '2025')).toEqual([]);
  });
});
