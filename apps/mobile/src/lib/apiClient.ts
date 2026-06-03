import { supabase } from './supabase';

// Strips trailing slash from env var, then appends the versioned base path.
// This means EXPO_PUBLIC_API_URL only needs the host — no need to include /api/v1.
const API_URL =
  (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '') +
  '/api/v1';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    // Try to parse JSON error body (e.g. from Railway or NestJS) to get a clean message
    let readable = message;
    try {
      const parsed = JSON.parse(message);
      readable = parsed.message ?? parsed.error ?? message;
    } catch {
      // not JSON — use raw text as-is
    }
    super(JSON.stringify({ status, message: readable }));
    this.name = 'ApiError';
  }
}


async function getHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session ? { Authorization: `Bearer ${session.access_token}` } : {})
  };
}

export const apiClient = {
  get: async <T>(path: string): Promise<T> => {
    const res = await fetch(`${API_URL}${path}`, {
      headers: await getHeaders(),
    });
    if (!res.ok) throw new ApiError(res.status, await res.text());
    return res.json();
  },

  post: async <T>(path: string, body: any): Promise<T> => {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new ApiError(res.status, await res.text());
    return res.json();
  },

  patch: async <T>(path: string, body: any): Promise<T> => {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'PATCH',
      headers: await getHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new ApiError(res.status, await res.text());
    return res.json();
  },

  delete: async <T>(path: string): Promise<T> => {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'DELETE',
      headers: await getHeaders(),
    });
    if (!res.ok) throw new ApiError(res.status, await res.text());
    return res.json();
  }
};
