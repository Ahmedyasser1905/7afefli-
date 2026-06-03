import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AuditService {
  constructor(private readonly supabase: SupabaseService) {}

  async log(params: {
    actorId?: string;
    role?: 'Client' | 'Coiffeur' | 'Admin';
    action: string;
    resource: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
  }): Promise<void> {
    const { error } = await this.supabase.adminClient.from('audit_log').insert({
      actor_id: params.actorId,
      role: params.role,
      action: params.action,
      resource: params.resource,
      metadata: params.metadata,
      ip_address: params.ipAddress,
    });

    if (error) {
      console.error('Failed to write audit log:', error.message);
    }
  }
}
