// services/api/src/auth/auth.guard.ts
// Verifies Supabase JWT from Authorization header and attaches user to request.
// Roles are cached in-memory for 5 minutes to avoid 2 Supabase calls per request.

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { SupabaseService } from '../supabase/supabase.service';

export interface AuthenticatedUser {
  id: string;
  email?: string;
  phone?: string;
  role: string;          // from profiles table
  accessToken: string;   // raw JWT for scoped client
}

interface CachedRole {
  role: string;
  expiresAt: number;   // Unix timestamp (ms)
}

// Module-level cache — shared across all requests in the same process.
// TTL: 5 minutes. This is intentional: role changes take up to 5 min to propagate.
// For immediate propagation (e.g. admin changes a role), clear the cache entry.
const roleCache = new Map<string, CachedRole>();
const ROLE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing authorization token');
    }

    try {
      // Verify JWT using Supabase admin client
      const { data: { user }, error } = await this.supabaseService.adminClient
        .auth.getUser(token);

      if (error || !user) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      // Check role cache first to avoid a Supabase DB call on every request
      const cached = roleCache.get(user.id);
      let role: string;

      if (cached && cached.expiresAt > Date.now()) {
        role = cached.role;
      } else {
        // Cache miss or expired — fetch from DB
        const { data: profile } = await this.supabaseService.adminClient
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        role = profile?.role ?? 'Client';

        // Store in cache
        roleCache.set(user.id, {
          role,
          expiresAt: Date.now() + ROLE_CACHE_TTL_MS,
        });
      }

      // Attach authenticated user to request
      (request as unknown as Record<string, unknown>).user = {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role,
        accessToken: token,
      } satisfies AuthenticatedUser;

      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Authentication failed');
    }
  }

  private extractToken(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader) return null;

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : null;
  }
}

/**
 * Invalidate the role cache for a specific user.
 * Call this from AdminService.changeUserRole() so role changes take effect immediately.
 */
export function invalidateRoleCache(userId: string): void {
  roleCache.delete(userId);
}
