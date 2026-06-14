// apps/mobile/src/lib/api.ts
// Shared API URL configuration.
// All actual HTTP calls go through apiClient.ts (which appends /api/v1).

export const API_URL =
  (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
