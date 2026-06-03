import { Test, TestingModule } from '@nestjs/testing';
import { ChargilyService } from './chargily.service';
import { ConfigService } from '@nestjs/config';

describe('ChargilyService', () => {
  let service: ChargilyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChargilyService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
      ],
    }).compile();

    service = module.get<ChargilyService>(ChargilyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('verifySignature', () => {
    it('should return false for invalid signature', () => {
      const isValid = service.verifySignature('invalid-sig', '{"test": "data"}');
      expect(isValid).toBe(false);
    });

    // We could add a test with a real valid HMAC if we generated one,
    // but verifying it returns false on random data is the critical path
  });
});
