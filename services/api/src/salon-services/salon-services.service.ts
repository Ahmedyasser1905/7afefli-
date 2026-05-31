// services/api/src/salon-services/salon-services.service.ts

import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateServiceDto } from './dto/create-service.dto';

@Injectable()
export class SalonServicesService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * List all active services for a salon.
   */
  async findBySalon(salonId: string) {
    const { data, error } = await this.supabase.adminClient
      .from('services')
      .select('*')
      .eq('salon_id', salonId)
      .eq('is_active', true)
      .order('price', { ascending: true });

    if (error) throw new Error(`Failed to fetch services: ${error.message}`);
    return data;
  }

  /**
   * Create a new service for a salon (owner only).
   */
  async create(salonId: string, dto: CreateServiceDto, userId: string) {
    await this.verifySalonOwnership(salonId, userId);

    const { data, error } = await this.supabase.adminClient
      .from('services')
      .insert({
        salon_id: salonId,
        service_name: dto.service_name,
        description: dto.description,
        price: dto.price,
        duration_minutes: dto.duration_minutes,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create service: ${error.message}`);
    return data;
  }

  /**
   * Update a service (owner only).
   */
  async update(salonId: string, serviceId: string, dto: Partial<CreateServiceDto>, userId: string) {
    await this.verifySalonOwnership(salonId, userId);

    const { data, error } = await this.supabase.adminClient
      .from('services')
      .update(dto)
      .eq('id', serviceId)
      .eq('salon_id', salonId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update service: ${error.message}`);
    if (!data) throw new NotFoundException('Service not found');
    return data;
  }

  /**
   * Soft-delete a service by setting is_active = false (owner only).
   */
  async deactivate(salonId: string, serviceId: string, userId: string) {
    await this.verifySalonOwnership(salonId, userId);

    const { data, error } = await this.supabase.adminClient
      .from('services')
      .update({ is_active: false })
      .eq('id', serviceId)
      .eq('salon_id', salonId)
      .select()
      .single();

    if (error) throw new Error(`Failed to deactivate service: ${error.message}`);
    if (!data) throw new NotFoundException('Service not found');
    return { message: 'Service deactivated successfully' };
  }

  /**
   * Verify that the user is the salon owner.
   */
  private async verifySalonOwnership(salonId: string, userId: string) {
    const { data: salon } = await this.supabase.adminClient
      .from('salons')
      .select('owner_id')
      .eq('id', salonId)
      .single();

    if (!salon) throw new NotFoundException('Salon not found');
    if (salon.owner_id !== userId) {
      throw new ForbiddenException('You can only manage services for your own salon');
    }
  }
}
