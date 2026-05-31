// apps/mobile/src/lib/api.ts
// Configuration for the external backend API

export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export const endpoints = {
  salons: `${API_URL}/salons`,
  reservations: `${API_URL}/reservations`,
  users: `${API_URL}/users`,
};

export const fetchAPI = async (endpoint: string, options?: RequestInit) => {
  const response = await fetch(endpoint, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API Request failed: ${response.statusText}`);
  }

  return response.json();
};
