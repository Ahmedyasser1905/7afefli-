// apps/mobile/src/lib/api.ts
// Shared API URL configuration.
// All actual HTTP calls go through apiClient.ts (which appends /api/v1).

export const API_URL =
  (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export const endpoints = {
  salons:       `${API_URL}/api/v1/salons`,
  reservations: `${API_URL}/api/v1/reservations`,
  slots:        `${API_URL}/api/v1/slots`,
  auth:         `${API_URL}/api/v1/auth`,
  subscriptions:`${API_URL}/api/v1/subscriptions`,
  locations:    `${API_URL}/api/v1/locations`,
};
