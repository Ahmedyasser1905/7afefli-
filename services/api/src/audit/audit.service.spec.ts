import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { SupabaseService } from '../supabase/supabase.service';

const mockQueryBuilder = {
  insert: jest.fn().mockResolvedValue({ error: null }),
};

const mockSupabaseAdminClient = {
  from: jest.fn(() => mockQueryBuilder),
};

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: SupabaseService,
          useValue: { adminClient: mockSupabaseAdminClient },
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log', () => {
    it('should insert audit log', async () => {
      await service.log({ action: 'TEST', resource: 'test' });
      expect(mockSupabaseAdminClient.from).toHaveBeenCalledWith('audit_log');
    });

    it('should handle errors gracefully', async () => {
      mockQueryBuilder.insert.mockResolvedValueOnce({ error: { message: 'db error' } });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      await service.log({ action: 'TEST', resource: 'test' });
      expect(consoleSpy).toHaveBeenCalledWith('Failed to write audit log:', 'db error');
      consoleSpy.mockRestore();
    });
  });
});
