// apps/mobile/src/store/languageStore.ts
// Global language store — persists user's preferred locale (fr | ar)
// Mirrors themeStore pattern for consistency.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppLocale = 'fr' | 'ar';

interface LanguageState {
  locale: AppLocale;
  isRTL: boolean;
  setLocale: (locale: AppLocale) => void;
  toggleLocale: () => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      locale: 'fr',
      isRTL: false,

      setLocale: (locale: AppLocale) => {
        set({ locale, isRTL: locale === 'ar' });
      },

      toggleLocale: () => {
        const next: AppLocale = get().locale === 'fr' ? 'ar' : 'fr';
        set({ locale: next, isRTL: next === 'ar' });
      },
    }),
    {
      name: 'language-preference',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
