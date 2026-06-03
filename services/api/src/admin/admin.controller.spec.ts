import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

const mockService = {
  getPendingSalons: jest.fn().mockResolvedValue([]),
  approveSalon: jest.fn().mockResolvedValue({}),
  getAllSalons: jest.fn().mockResolvedValue([]),
  deleteSalon: jest.fn().mockResolvedValue({}),
  getAllUsers: jest.fn().mockResolvedValue([]),
  changeUserRole: jest.fn().mockResolvedValue({}),
  getStats: jest.fn().mockResolvedValue({}),
  getAuditLogs: jest.fn().mockResolvedValue([]),
  exportAuditLogsCsv: jest.fn().mockResolvedValue(''),
  getRevenueStats: jest.fn().mockResolvedValue({}),
  getAllReservations: jest.fn().mockResolvedValue([]),
  getAllSubscriptions: jest.fn().mockResolvedValue([]),
};

describe('AdminController', () => {
  let controller: AdminController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: require('../supabase/supabase.service').SupabaseService, useValue: {} },
        {
          provide: AdminService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call getPendingSalons', async () => {
    expect(await controller.getPendingSalons()).toEqual([]);
  });

  it('should call approveSalon', async () => {
    expect(await controller.approveSalon('1', true)).toEqual({});
  });

  it('should call getAllSalons', async () => {
    expect(await controller.getAllSalons()).toEqual([]);
  });

  it('should call deleteSalon', async () => {
    expect(await controller.deleteSalon('1')).toEqual({});
  });

  it('should call getAllUsers', async () => {
    expect(await controller.getAllUsers()).toEqual([]);
  });

  it('should call changeUserRole', async () => {
    expect(await controller.changeUserRole('1', { role: 'Admin' })).toEqual({});
  });

  it('should call getStats', async () => {
    expect(await controller.getStats()).toEqual({});
  });

  it('should call getAuditLogs', async () => {
    expect(await controller.getAuditLogs()).toEqual([]);
  });

  it('should call exportAuditLogsCsv', async () => {
    expect(await controller.exportAuditLogsCsv()).toEqual('');
  });

  it('should call getRevenueStats', async () => {
    expect(await controller.getRevenueStats()).toEqual({});
  });

  it('should call getAllReservations', async () => {
    expect(await controller.getAllReservations()).toEqual([]);
  });

  it('should call getAllSubscriptions', async () => {
    expect(await controller.getAllSubscriptions()).toEqual([]);
  });
});
