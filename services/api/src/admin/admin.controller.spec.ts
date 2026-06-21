import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthenticatedUser } from '../auth/auth.guard';

const mockAdmin: AuthenticatedUser = {
  id: 'admin-uuid',
  email: 'admin@test.com',
  role: 'Admin',
  accessToken: 'token',
};

const mockService = {
  getPendingSalons: jest.fn().mockResolvedValue([]),
  approveSalon: jest.fn().mockResolvedValue({}),
  getAllSalons: jest.fn().mockResolvedValue([]),
  deleteSalon: jest.fn().mockResolvedValue({}),
  getAllUsers: jest.fn().mockResolvedValue([]),
  deleteUser: jest.fn().mockResolvedValue({}),
  banUser: jest.fn().mockResolvedValue({}),
  changeUserRole: jest.fn().mockResolvedValue({}),
  getStats: jest.fn().mockResolvedValue({}),
  getAuditLogs: jest.fn().mockResolvedValue([]),
  exportAuditLogsCsv: jest.fn().mockResolvedValue(''),
  getRevenueStats: jest.fn().mockResolvedValue({}),
  getAllReservations: jest.fn().mockResolvedValue([]),
  deleteReservation: jest.fn().mockResolvedValue({}),
  getAllSubscriptions: jest.fn().mockResolvedValue([]),
  broadcastNotification: jest.fn().mockResolvedValue({ sent: 1 }),
  getBroadcasts: jest.fn().mockResolvedValue([]),
  getAnalytics: jest.fn().mockResolvedValue({}),
  sponsorSalon: jest.fn().mockResolvedValue({}),
  unsponsorSalon: jest.fn().mockResolvedValue({}),
  updateSalon: jest.fn().mockResolvedValue({}),
  getPayments: jest.fn().mockResolvedValue([]),
  getAllReviews: jest.fn().mockResolvedValue([]),
  deleteReview: jest.fn().mockResolvedValue({}),
  updatePlan: jest.fn().mockResolvedValue({}),
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

  it('should call banUser', async () => {
    expect(await controller.banUser('other-user', true, mockAdmin)).toEqual({});
  });

  it('should throw ForbiddenException when admin tries to ban themselves', () => {
    expect(() =>
      controller.banUser(mockAdmin.id, true, mockAdmin),
    ).toThrow(ForbiddenException);
  });

  it('should call changeUserRole', async () => {
    expect(
      await controller.changeUserRole('other-user', { role: 'Coiffeur' }, mockAdmin),
    ).toEqual({});
  });

  it('should throw ForbiddenException when admin tries to downgrade their own role', () => {
    expect(() =>
      controller.changeUserRole(mockAdmin.id, { role: 'Client' }, mockAdmin),
    ).toThrow(ForbiddenException);
  });

  it('should allow admin to keep their own Admin role', async () => {
    expect(
      await controller.changeUserRole(mockAdmin.id, { role: 'Admin' }, mockAdmin),
    ).toEqual({});
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

  it('should call broadcastNotification with a valid admin user', async () => {
    expect(
      await controller.broadcastNotification({ title: 'T', body: 'B' }, mockAdmin),
    ).toEqual({ sent: 1 });
  });

  it('should throw ForbiddenException when broadcastNotification receives no admin id', () => {
    const invalidAdmin = { ...mockAdmin, id: '' };
    expect(() =>
      controller.broadcastNotification({ title: 'T', body: 'B' }, invalidAdmin as AuthenticatedUser),
    ).toThrow(ForbiddenException);
  });

  it('should call getBroadcasts', async () => {
    expect(await controller.getBroadcasts()).toEqual([]);
  });
});
