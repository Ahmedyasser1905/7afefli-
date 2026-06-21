// apps/admin/lib/requireAdmin.ts
// Shared server-side auth helper for Next.js API route handlers.
//
// Defense-in-depth: Next.js middleware protects pages but route handlers
// can be called directly (e.g. via curl). This utility re-validates the
// caller's JWT and Admin role inside every route handler so we are never
// solely relying on middleware for API-level protection.
//
// Usage:
//   const auth = await requireAdmin(request);
//   if (auth.error) return auth.error;
//   const { user } = auth; // AuthenticatedAdmin

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from './supabaseAdmin';

export interface AuthenticatedAdmin {
  id: string;
  email?: string;
}

type RequireAdminResult =
  | { user: AuthenticatedAdmin; error: null }
  | { user: null; error: NextResponse };

/**
 * Verifies the Bearer token from the Authorization header and confirms
 * that the authenticated user holds the 'Admin' role in the profiles table.
 *
 * Returns { user } on success, or { error: NextResponse } on failure.
 * The caller should return the error response immediately if present.
 */
export async function requireAdmin(request: NextRequest): Promise<RequireAdminResult> {
  // 1. Extract Bearer token from Authorization header
  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Unauthorized: missing or malformed Authorization header' },
        { status: 401 },
      ),
    };
  }

  try {
    const supabase = createAdminClient();

    // 2. Verify JWT with Supabase auth — this validates the token signature and expiry
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return {
        user: null,
        error: NextResponse.json(
          { error: 'Unauthorized: invalid or expired token' },
          { status: 401 },
        ),
      };
    }

    // 3. Verify the user has the 'Admin' role in the profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return {
        user: null,
        error: NextResponse.json(
          { error: 'Forbidden: profile not found' },
          { status: 403 },
        ),
      };
    }

    if (profile.role !== 'Admin') {
      return {
        user: null,
        error: NextResponse.json(
          { error: 'Forbidden: Admin role required' },
          { status: 403 },
        ),
      };
    }

    return {
      user: { id: user.id, email: user.email },
      error: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal auth error';
    return {
      user: null,
      error: NextResponse.json({ error: message }, { status: 500 }),
    };
  }
}
