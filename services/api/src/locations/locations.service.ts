import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class LocationsService {
  constructor(private readonly supabase: SupabaseService) {}

  async findAllWilayas() {
    const { data, error } = await this.supabase.adminClient
      .from('wilayas')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      throw new InternalServerErrorException(`Failed to fetch wilayas: ${error.message}`);
    }

    return data.map((w: any) => w.name);
  }
}
