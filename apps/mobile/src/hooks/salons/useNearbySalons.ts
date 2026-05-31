// apps/mobile/src/hooks/salons/useNearbySalons.ts
// Fetches nearby salons using PostGIS geolocation via Supabase RPC

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
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

      // Call PostGIS-powered RPC function
      const { data, error } = await supabase.rpc('get_nearby_salons', {
        user_lat: location.latitude,
        user_lng: location.longitude,
        radius_km: radiusKm,
      });

      if (error) {
        console.warn('[useNearbySalons] RPC error:', error);
        return [];
      }

      return (data ?? []) as Salon[];
    },

    enabled: !!location,
    staleTime: 5 * 60 * 1000, // 5 minutes — salons don't change often
  });
}

export function useSalonDetail(salonId: string | null) {
  return useQuery<Salon>({
    queryKey: ['salon-detail', salonId],

    queryFn: async (): Promise<Salon> => {
      const { data, error } = await supabase
        .from('salons')
        .select(
          `
          *,
          services (*),
          salon_staff (*, profiles:profile_id (full_name, avatar_url)),
          portfolio_photos (*),
          reviews (*, profiles:client_id (full_name, avatar_url))
        `,
        )
        .eq('id', salonId!)
        .single();

      if (error) throw new Error(error.message);
      return data as Salon;
    },

    enabled: !!salonId,
    staleTime: 3 * 60 * 1000, // 3 minutes — detail page data doesn't change often
  });
}

export function useSalonServices(salonId: string | null) {
  return useQuery({
    queryKey: ['salon-services', salonId],

    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('salon_id', salonId!)
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (error) throw new Error(error.message);
      return data;
    },

    enabled: !!salonId,
    staleTime: 3 * 60 * 1000,
  });
}
