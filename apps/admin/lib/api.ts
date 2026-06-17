// apps/admin/lib/api.ts
// Centralised fetch helper that prepends /api/v1 to every path.
// Fix C5: all admin pages were calling ${NEXT_PUBLIC_API_URL}/admin/...
// which resolves to a 404 because the NestJS app is prefixed with /api/v1.

const BASE = (): string => {
  return '/api';
};

/**
 * Typed fetch wrapper used by all admin pages.
 * Usage: apiFetch('/admin/stats', token)
 */
export async function apiFetch<T = unknown>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${BASE()}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}
