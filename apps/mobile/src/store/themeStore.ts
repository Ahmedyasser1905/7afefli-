// apps/mobile/src/store/themeStore.ts
// Global dark/light mode store with AsyncStorage persistence

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'dark' | 'light';

interface ThemeState {
  mode: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'dark',
      isDark: true,
      toggleTheme: () => {
        const next: ThemeMode = get().mode === 'dark' ? 'light' : 'dark';
        set({ mode: next, isDark: next === 'dark' });
      },
      setTheme: (mode: ThemeMode) => {
        set({ mode, isDark: mode === 'dark' });
      },
    }),
    {
      name: 'theme-preference',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
