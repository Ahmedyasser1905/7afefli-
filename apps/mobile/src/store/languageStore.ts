// apps/mobile/src/store/languageStore.ts
// Global language store — persists user's preferred locale (fr | ar)
// Calls I18nManager.forceRTL() so native components mirror correctly.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';

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
        const rtl = locale === 'ar';
        I18nManager.forceRTL(rtl);
        set({ locale, isRTL: rtl });
      },

      toggleLocale: () => {
        const next: AppLocale = get().locale === 'fr' ? 'ar' : 'fr';
        const rtl = next === 'ar';
        I18nManager.forceRTL(rtl);
        set({ locale: next, isRTL: rtl });
      },
    }),
    {
      name: 'language-preference',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
