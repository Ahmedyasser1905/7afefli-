// apps/mobile/src/store/mapPreferencesStore.ts
// Persists user map settings (wilaya filter, sort preference, show map toggle)
// across app sessions using AsyncStorage via zustand/persist.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface MapPreferencesState {
  // Explore / Home filters
  selectedWilaya: string;
  selectedSort: 'rating' | 'distance' | 'price';
  showMap: boolean;
  activeHomeFilters: string[];

  // Setters
  setSelectedWilaya: (wilaya: string) => void;
  setSelectedSort: (sort: 'rating' | 'distance' | 'price') => void;
  setShowMap: (show: boolean) => void;
  setActiveHomeFilters: (filters: string[]) => void;
  toggleHomeFilter: (filterId: string) => void;
  reset: () => void;
}

const DEFAULTS = {
  selectedWilaya: 'Toutes',
  selectedSort: 'rating' as const,
  showMap: true,
  activeHomeFilters: ['nearby'],
};

export const useMapPreferences = create<MapPreferencesState>()(
  persist(
    (set, get) => ({
      ...DEFAULTS,

      setSelectedWilaya: (wilaya) => set({ selectedWilaya: wilaya }),
      setSelectedSort: (sort) => set({ selectedSort: sort }),
      setShowMap: (show) => set({ showMap: show }),
      setActiveHomeFilters: (filters) => set({ activeHomeFilters: filters }),

      toggleHomeFilter: (filterId) => {
        const current = get().activeHomeFilters;
        const next = current.includes(filterId)
          ? current.filter((f) => f !== filterId)
          : [...current, filterId];
        set({ activeHomeFilters: next });
      },

      reset: () => set(DEFAULTS),
    }),
    {
      name: 'hafefli-map-prefs',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
