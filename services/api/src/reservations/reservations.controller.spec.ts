import { Test, TestingModule } from '@nestjs/testing';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

const mockService = {
  create: jest.fn().mockResolvedValue({ id: '1' }),
  blockTime: jest.fn().mockResolvedValue({ id: '2' }),
  findByClient: jest.fn().mockResolvedValue([]),
  findBySalon: jest.fn().mockResolvedValue([]),
  updateStatus: jest.fn().mockResolvedValue({ id: '1', status: 'Confirmed' }),
  findOne: jest.fn().mockResolvedValue({ id: '1' }),
};

describe('ReservationsController', () => {
  let controller: ReservationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReservationsController],
      providers: [
        { provide: require('../supabase/supabase.service').SupabaseService, useValue: {} },
        {
          provide: ReservationsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<ReservationsController>(ReservationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call create', async () => {
    const dto = { salonId: '1', serviceId: '1', appointmentDate: '2025-01-01', startTime: '10:00' } as any;
    expect(await controller.create(dto, { id: 'u1' } as any)).toEqual({ id: '1' });
  });

  it('should call blockTime', async () => {
    expect(await controller.blockTime({ salonId: '1', date: '2025', startTime: '1', endTime: '2' }, { id: 'u1' } as any)).toEqual({ id: '2' });
  });

  it('should call findMyReservations', async () => {
    expect(await controller.findMyReservations({ id: 'u1' } as any)).toEqual([]);
  });

  it('should call findBySalon', async () => {
    expect(await controller.findBySalon('1', undefined, { id: 'u1' } as any)).toEqual([]);
  });

  it('should call updateStatus', async () => {
    expect(await controller.updateStatus('1', { status: 'Confirmed' } as any, { id: 'u1' } as any)).toEqual({ id: '1', status: 'Confirmed' });
  });

  it('should call findOne with user argument', async () => {
    expect(await controller.findOne('1', { id: 'u1' } as any)).toEqual({ id: '1' });
  });
});
