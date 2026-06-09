import { Test, TestingModule } from '@nestjs/testing';
import { SalonsController } from './salons.controller';
import { SalonsService } from './salons.service';
import { SalonServicesService } from '../salon-services/salon-services.service';

const mockSalonServicesService = {
  findBySalon: jest.fn().mockResolvedValue([]),
};

const mockSalonsService = {
  findAll: jest.fn().mockResolvedValue([]),
  findNearby: jest.fn().mockResolvedValue([]),
  findByOwner: jest.fn().mockResolvedValue({}),
  findOne: jest.fn().mockResolvedValue({ id: '1' }),
  create: jest.fn().mockResolvedValue({ id: '1' }),
  update: jest.fn().mockResolvedValue({ id: '1' }),
  addStaff: jest.fn().mockResolvedValue({ id: 's1' }),
  getStaff: jest.fn().mockResolvedValue([]),
  removeStaff: jest.fn().mockResolvedValue({ message: 'Success' }),
  updateStaffAvatar: jest.fn().mockResolvedValue({ id: 's1' }),
  getPortfolio: jest.fn().mockResolvedValue([]),
  addPortfolioPhoto: jest.fn().mockResolvedValue({ id: 'p1' }),
  removePortfolioPhoto: jest.fn().mockResolvedValue({ message: 'Success' }),
};

describe('SalonsController', () => {
  let controller: SalonsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SalonsController],
      providers: [
        { provide: require('../supabase/supabase.service').SupabaseService, useValue: {} },
        {
          provide: SalonsService,
          useValue: mockSalonsService,
        },
        {
          provide: SalonServicesService,
          useValue: mockSalonServicesService,
        },
      ],
    }).compile();

    controller = module.get<SalonsController>(SalonsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call findAll', async () => {
    expect(await controller.findAll()).toEqual([]);
  });

  it('should call findNearby', async () => {
    expect(await controller.findNearby(12.1, 12.2)).toEqual([]);
  });

  it('should call findMySalon', async () => {
    expect(await controller.findMySalon({ id: 'owner1' } as any)).toEqual({});
  });

  it('should call findOne', async () => {
    expect(await controller.findOne('1')).toEqual({ id: '1' });
  });

  it('should call create', async () => {
    const dto = { name: 'Salon 1' } as any;
    expect(await controller.create(dto, { id: 'owner1' } as any)).toEqual({ id: '1' });
  });
  
  it('should call update', async () => {
    expect(await controller.update('1', { name: 'Updated' } as any, { id: 'owner1' } as any)).toEqual({ id: '1' });
  });

  it('should call addStaff', async () => {
    expect(await controller.addStaff('1', { customName: 'Staff' } as any, { id: 'owner1' } as any)).toEqual({ id: 's1' });
  });

  it('should call getStaff', async () => {
    expect(await controller.getStaff('1')).toEqual([]);
  });

  it('should call removeStaff', async () => {
    expect(await controller.removeStaff('1', 's1', { id: 'owner1' } as any)).toEqual({ message: 'Success' });
  });

  it('should call updateStaffAvatar', async () => {
    expect(await controller.updateStaffAvatar('1', 's1', 'url', { id: 'owner1' } as any)).toEqual({ id: 's1' });
  });

  it('should call getPortfolio', async () => {
    expect(await controller.getPortfolio('1')).toEqual([]);
  });

  it('should call addPortfolioPhoto', async () => {
    expect(await controller.addPortfolioPhoto('1', 'path', { id: 'owner1' } as any)).toEqual({ id: 'p1' });
  });

  it('should call removePortfolioPhoto', async () => {
    expect(await controller.removePortfolioPhoto('1', 'p1', { id: 'owner1' } as any)).toEqual({ message: 'Success' });
  });
});
