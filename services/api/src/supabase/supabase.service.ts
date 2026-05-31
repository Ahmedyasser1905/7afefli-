// services/api/src/supabase/supabase.service.ts
// Provides Supabase clients for server-side operations

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private _adminClient!: SupabaseClient;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const supabaseUrl = this.configService.getOrThrow<string>('SUPABASE_URL');
    const serviceRoleKey = this.configService.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');

    // Admin client using service role key — bypasses RLS
    // Use for admin operations, slot generation, and server-side queries
    this._adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  /**
   * Admin client with service role key.
   * Bypasses RLS — use for trusted server-side operations only.
   */
  get adminClient(): SupabaseClient {
    return this._adminClient;
  }

  /**
   * Create a scoped client that respects RLS using the user's JWT.
   * Use for operations where row-level security should be enforced.
   */
  getClientForUser(accessToken: string): SupabaseClient {
    const supabaseUrl = this.configService.getOrThrow<string>('SUPABASE_URL');
    const serviceRoleKey = this.configService.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');

    return createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });
  }
}
