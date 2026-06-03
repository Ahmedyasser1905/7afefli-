import { Test, TestingModule } from '@nestjs/testing';
import { SalonServicesController } from './salon-services.controller';
import { SalonServicesService } from './salon-services.service';

const mockService = {
  findBySalon: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockResolvedValue({ id: '1' }),
  update: jest.fn().mockResolvedValue({ id: '1' }),
  deactivate: jest.fn().mockResolvedValue({ message: 'Success' }),
};

describe('SalonServicesController', () => {
  let controller: SalonServicesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SalonServicesController],
      providers: [
        { provide: require('../supabase/supabase.service').SupabaseService, useValue: {} },
        {
          provide: SalonServicesService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<SalonServicesController>(SalonServicesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call findBySalon', async () => {
    expect(await controller.findBySalon('1')).toEqual([]);
  });

  it('should call create', async () => {
    expect(await controller.create('1', { name: 'Service 1', duration: 30, price: 500 } as any, { id: 'u1' } as any)).toEqual({ id: '1' });
  });

  it('should call update', async () => {
    expect(await controller.update('1', 's1', { name: 'Updated' } as any, { id: 'u1' } as any)).toEqual({ id: '1' });
  });

  it('should call removeService', async () => {
    expect(await controller.removeService('1', 's1', { id: 'u1' } as any)).toEqual({ message: 'Success' });
  });
});
