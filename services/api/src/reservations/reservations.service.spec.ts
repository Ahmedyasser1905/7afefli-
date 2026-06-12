// services/api/src/reservations/reservations.service.spec.ts
// Security + business logic tests for ReservationsService.

import { Test, TestingModule } from '@nestjs/testing';
import { ReservationsService } from './reservations.service';
import { SupabaseService } from '../supabase/supabase.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

// --------------------------------------------------------------------------
// Mock supabase query builder
// --------------------------------------------------------------------------
const buildMockQuery = () => {
  const query: any = {
    select: jest.fn().mockImplementation(() => query),
    eq: jest.fn().mockImplementation(() => query),
    in: jest.fn().mockImplementation(() => query),
    limit: jest.fn().mockImplementation(() => query),
    gte: jest.fn().mockImplementation(() => query),
    lte: jest.fn().mockImplementation(() => query),
    gt: jest.fn().mockImplementation(() => query),
    lt: jest.fn().mockImplementation(() => query),
    not: jest.fn().mockImplementation(() => query),
    ilike: jest.fn().mockImplementation(() => query),
    single: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    update: jest.fn().mockImplementation(() => query),
    insert: jest.fn().mockImplementation(() => query),
    order: jest.fn().mockImplementation(() => query),
    or: jest.fn().mockImplementation(() => query),
    then: jest.fn().mockImplementation((onFulfilled) => {
      return Promise.resolve({ data: [], error: null }).then(onFulfilled);
    }),
  };
  return query;
};

let mockQuery = buildMockQuery();

const mockServicesQuery = buildMockQuery();
const mockSalonsQuery = buildMockQuery();
const mockStaffQuery = buildMockQuery();
const mockReservationsQuery = buildMockQuery();

const mockSupabaseAdminClient = {
  from: jest.fn((table) => {
    if (table === 'services') return mockServicesQuery;
    if (table === 'salons') return mockSalonsQuery;
    if (table === 'salon_staff') return mockStaffQuery;
    return mockReservationsQuery;
  }),
  rpc: jest.fn(),
};

const mockCacheManager = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
};

// --------------------------------------------------------------------------
// Helper: authenticated users
// --------------------------------------------------------------------------
const clientUser   = { id: 'client1', role: 'Client', email: 'c@c.com', phone: '0', accessToken: 't' };
const barberUser   = { id: 'barber1', role: 'Coiffeur', email: 'b@b.com', phone: '0', accessToken: 't' };
const adminUser    = { id: 'admin1', role: 'Admin', email: 'a@a.com', phone: '0', accessToken: 't' };
const strangerUser = { id: 'stranger', role: 'Client', email: 's@s.com', phone: '0', accessToken: 't' };

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------
describe('ReservationsService', () => {
  let service: ReservationsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    mockQuery = buildMockQuery();
    
    mockServicesQuery.single = mockQuery.single;
    mockServicesQuery.maybeSingle = mockQuery.maybeSingle;
    
    mockSalonsQuery.single = jest.fn().mockResolvedValue({
      data: {
        owner_id: 'barber1',
        name: 'Mock Salon',
        description: 'Mock Description',
        wilaya: 'Mock Wilaya',
        commune: 'Mock Commune',
        address: 'Mock Address',
        phone: '0555555555',
        latitude: 36.75,
        longitude: 3.06,
        open_time: '09:00:00',
        close_time: '21:00:00',
        working_days: [0, 1, 2, 3, 4, 5, 6],
        image_url: 'logo_url',
        services: [{ id: 'svc1' }],
        portfolio_photos: [{ id: 'photo1' }],
        salon_staff: [{ id: 'staff1' }]
      },
      error: null,
    });
    mockStaffQuery.single = mockQuery.single;
    mockStaffQuery.maybeSingle = jest.fn().mockResolvedValue({
      data: { id: 'staff1', profile_id: 'barber1' },
      error: null,
    });
    
    mockReservationsQuery.single = mockQuery.single;
    mockReservationsQuery.maybeSingle = mockQuery.maybeSingle;
    
    mockSupabaseAdminClient.from.mockImplementation((table) => {
      if (table === 'services') return mockServicesQuery;
      if (table === 'salons') return mockSalonsQuery;
      if (table === 'salon_staff') return mockStaffQuery;
      return mockReservationsQuery;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        {
          provide: SupabaseService,
          useValue: { adminClient: mockSupabaseAdminClient },
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        {
          provide: NotificationsService,
          useValue: {
            createNotification: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<ReservationsService>(ReservationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────────────────────
  describe('create', () => {
    it('should calculate end time and call RPC', async () => {
      // Service duration lookup
      mockQuery.single
        .mockResolvedValueOnce({ data: { duration_minutes: 30 }, error: null });

      // RPC create_reservation_safe
      mockSupabaseAdminClient.rpc.mockResolvedValueOnce({
        data: { id: 'res123' },
        error: null,
      });

      // Enriched data lookup
      mockQuery.single
        .mockResolvedValueOnce({ data: { id: 'res123', status: 'Pending' }, error: null });

      const res = await service.create(
        { salonId: 'salon1', serviceId: 'svc1', appointmentDate: '2028-01-01', startTime: '10:00' },
        clientUser.id,
      );

      expect(res).toBeDefined();
      expect(mockSupabaseAdminClient.rpc).toHaveBeenCalledWith(
        'create_reservation_safe',
        expect.objectContaining({
          p_client_id: clientUser.id,
          p_start_time: '10:00',
          p_end_time: '10:30',
        }),
      );
    });

    it('should throw BadRequestException if service not found', async () => {
      mockQuery.single.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

      await expect(
        service.create(
          { salonId: '1', serviceId: '2', appointmentDate: '2028-01-01', startTime: '10:00' },
          clientUser.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException on double-booking', async () => {
      mockQuery.single.mockResolvedValueOnce({ data: { duration_minutes: 30 }, error: null });
      mockSupabaseAdminClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'slot already booked', code: 'P0001' },
      });

      await expect(
        service.create(
          { salonId: '1', serviceId: '2', appointmentDate: '2028-01-01', startTime: '10:00' },
          clientUser.id,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should invalidate slot cache after successful booking', async () => {
      mockQuery.single.mockResolvedValueOnce({ data: { duration_minutes: 30 }, error: null });
      mockSupabaseAdminClient.rpc.mockResolvedValueOnce({
        data: { id: 'res123' },
        error: null,
      });
      mockQuery.single.mockResolvedValueOnce({ data: { id: 'res123' }, error: null });

      await service.create(
        { salonId: 'salon1', serviceId: 'svc1', appointmentDate: '2028-01-01', startTime: '10:00' },
        clientUser.id,
      );

      expect(mockCacheManager.del).toHaveBeenCalledWith(
        'slots_v2:salon1:svc1:2028-01-01:any',
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findOne — ownership / access control
  // ─────────────────────────────────────────────────────────────────────────
  describe('findOne — reservation ownership', () => {
    const reservationData = {
      id: 'res1',
      salon_id: 'salon1',
      client_id: clientUser.id,
      barber_id: barberUser.id,
      salons: { owner_id: barberUser.id },
    };

    it('should return reservation to the client (owner)', async () => {
      mockQuery.single.mockResolvedValueOnce({ data: reservationData, error: null });

      const res = await service.findOne('res1', clientUser);
      expect(res).toEqual(reservationData);
    });

    it('should return reservation to the barber (assigned staff)', async () => {
      mockQuery.single.mockResolvedValueOnce({ data: reservationData, error: null });

      const res = await service.findOne('res1', barberUser);
      expect(res).toEqual(reservationData);
    });

    it('should return reservation to Admin regardless of ownership', async () => {
      mockQuery.single.mockResolvedValueOnce({ data: reservationData, error: null });

      const res = await service.findOne('res1', adminUser);
      expect(res).toEqual(reservationData);
    });

    it('should throw ForbiddenException for a stranger with no relation', async () => {
      const data = { ...reservationData, client_id: clientUser.id, barber_id: null, salons: { owner_id: 'other' } };
      mockQuery.single.mockResolvedValueOnce({ data, error: null });
      // Staff check returns null
      mockStaffQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

      await expect(service.findOne('res1', strangerUser)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when reservation does not exist', async () => {
      mockQuery.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

      await expect(service.findOne('missing-id', clientUser)).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // updateStatus
  // ─────────────────────────────────────────────────────────────────────────
  describe('updateStatus', () => {
    it('should throw NotFoundException if reservation missing', async () => {
      mockQuery.single.mockResolvedValueOnce({ data: null, error: null });
      await expect(service.updateStatus('r1', { status: 'Confirmed' }, 'u1')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if client tries to confirm', async () => {
      mockQuery.single.mockResolvedValueOnce({
        data: { client_id: clientUser.id, salons: { owner_id: barberUser.id }, status: 'Pending' },
      });
      await expect(
        service.updateStatus('r1', { status: 'Confirmed' }, clientUser.id),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow client to cancel pending reservation', async () => {
      mockQuery.single.mockResolvedValueOnce({
        data: { client_id: clientUser.id, salons: { owner_id: barberUser.id }, status: 'Pending' },
      });
      mockQuery.single.mockResolvedValueOnce({ data: { id: 'r1', status: 'Cancelled' }, error: null });

      const res = await service.updateStatus('r1', { status: 'Cancelled' }, clientUser.id);
      expect(res.status).toBe('Cancelled');
    });

    it('should allow client to cancel confirmed reservation', async () => {
      mockQuery.single.mockResolvedValueOnce({
        data: { client_id: clientUser.id, salons: { owner_id: barberUser.id }, status: 'Confirmed' },
      });
      mockQuery.single.mockResolvedValueOnce({ data: { id: 'r1', status: 'Cancelled' }, error: null });

      const res = await service.updateStatus('r1', { status: 'Cancelled' }, clientUser.id);
      expect(res.status).toBe('Cancelled');
    });

    it('should clear cancellation metadata when updating status to Confirmed', async () => {
      mockQuery.single.mockResolvedValueOnce({
        data: { client_id: clientUser.id, salons: { owner_id: barberUser.id }, status: 'Cancelled', cancelled_by: 'u1' },
      });
      mockQuery.single.mockResolvedValueOnce({ data: { id: 'r1', status: 'Confirmed', cancelled_by: null, cancel_reason: null }, error: null });

      const res = await service.updateStatus('r1', { status: 'Confirmed' }, barberUser.id);
      expect(res.status).toBe('Confirmed');
    });

    it('should NOT allow client to cancel already-cancelled reservation', async () => {
      mockQuery.single.mockResolvedValueOnce({
        data: { client_id: clientUser.id, salons: { owner_id: barberUser.id }, status: 'Cancelled' },
      });
      await expect(
        service.updateStatus('r1', { status: 'Cancelled' }, clientUser.id),
      ).rejects.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // blockTime
  // ─────────────────────────────────────────────────────────────────────────
  describe('blockTime', () => {
    it('should insert a blocked reservation record', async () => {
      mockQuery.maybeSingle
        .mockResolvedValueOnce({ data: { id: 'svc1' }, error: null }) // fallbackServiceId
        .mockResolvedValueOnce({ data: null, error: null });          // existingBlock check
      
      mockQuery.single.mockResolvedValueOnce({ data: { id: 'block1' }, error: null }); // insert

      const res = await service.blockTime('salon1', 'barber1', '2028-01-01', '14:00', '15:00');
      expect(res).toBeDefined();
    });

    it('should throw ConflictException if slot already booked', async () => {
      mockQuery.maybeSingle
        .mockResolvedValueOnce({ data: { id: 'svc1' }, error: null }) // fallbackServiceId
        .mockResolvedValueOnce({ data: { id: 'block1', start_time: '14:00', end_time: '15:00' }, error: null }); // existingBlock check

      await expect(
        service.blockTime('salon1', 'barber1', '2028-01-01', '14:00', '15:00'),
      ).rejects.toThrow(ConflictException);
    });
  });
});
