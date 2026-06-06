// apps/mobile/src/hooks/salons/useNearbySalons.ts
// Fetches nearby salons. Falls back to Algiers coordinates if location is unavailable.

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient';
import type { Salon } from '@barberdz/shared/types';

const ALGIERS_FALLBACK = { latitude: 36.7538, longitude: 3.0588 };

interface Coords {
  latitude: number;
  longitude: number;
}

export function useNearbySalons(location: Coords | null) {
  // Use provided location or fall back to Algiers — never block the query on missing location
  const coords = location ?? ALGIERS_FALLBACK;

  return useQuery<Salon[]>({
    queryKey: ['nearby-salons', coords.latitude.toFixed(3), coords.longitude.toFixed(3)],
    queryFn: async () => {
      const data = await apiClient.get<Salon[]>(
        `/salons/nearby?lat=${coords.latitude}&lng=${coords.longitude}&radius=15&limit=30`,
      );
      return data ?? [];
    },
    staleTime: 2 * 60 * 1000,
    // Always enabled — never blocks on location
    enabled: true,
  });
}
