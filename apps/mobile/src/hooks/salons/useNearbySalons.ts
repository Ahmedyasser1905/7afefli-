// apps/mobile/src/hooks/salons/useNearbySalons.ts
// Fetches nearby salons using PostGIS geolocation via NestJS API

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient';
import type { Salon } from '@barberdz/shared/types';

interface Coords {
  latitude: number;
  longitude: number;
}

export function useNearbySalons(location: Coords | null, radiusKm: number = 10) {
  return useQuery<Salon[]>({
    queryKey: ['nearby-salons', location?.latitude, location?.longitude, radiusKm],

    queryFn: async (): Promise<Salon[]> => {
      if (!location) return [];

      try {
        const data = await apiClient.get<Salon[]>(`/salons/nearby?lat=${location.latitude}&lng=${location.longitude}&radius=${radiusKm}`);
        return data ?? [];
      } catch (error) {
        console.warn('[useNearbySalons] API error:', error);
        return [];
      }
    },

    enabled: !!location,
    staleTime: 5 * 60 * 1000, // 5 minutes — salons don't change often
  });
}

export function useSalonDetail(salonId: string | null) {
  return useQuery<Salon>({
    queryKey: ['salon-detail', salonId],

    queryFn: async (): Promise<Salon> => {
      const data = await apiClient.get<Salon>(`/salons/${salonId}`);
      return data;
    },

    enabled: !!salonId,
    staleTime: 3 * 60 * 1000, // 3 minutes — detail page data doesn't change often
  });
}

export function useSalonServices(salonId: string | null) {
  return useQuery({
    queryKey: ['salon-services', salonId],

    queryFn: async () => {
      const data = await apiClient.get<Record<string, unknown>[]>(`/salons/${salonId}/services`);
      return data;
    },

    enabled: !!salonId,
    staleTime: 3 * 60 * 1000,
  });
}
