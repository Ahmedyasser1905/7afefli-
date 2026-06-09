import { Test, TestingModule } from '@nestjs/testing';
import { LocationsService } from './locations.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('LocationsService', () => {
  let service: LocationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationsService,
        { provide: SupabaseService, useValue: {} },
      ],
    }).compile();

    service = module.get<LocationsService>(LocationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
