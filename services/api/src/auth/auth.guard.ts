// services/api/src/auth/auth.guard.ts
// Verifies Supabase JWT from Authorization header and attaches user to request

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

      // Fetch user profile to get role
      const { data: profile } = await this.supabaseService.adminClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      // Attach authenticated user to request
      (request as any).user = {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: profile?.role ?? 'Client',
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
