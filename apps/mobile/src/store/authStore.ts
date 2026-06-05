// apps/mobile/src/store/authStore.ts

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import type { Session, User } from '@supabase/supabase-js';
import type { UserRole } from '@barberdz/shared/types';

interface AuthState {
  session: Session | null;
  user: User | null;
  role: UserRole | null;
  isLoading: boolean;
  needsPhone: boolean;
  needsPasswordReset: boolean;

  setSession: (session: Session | null) => void;
  setRole: (role: UserRole) => void;
  setNeedsPhone: (needsPhone: boolean) => void;
  setNeedsPasswordReset: (needsPasswordReset: boolean) => void;
  clearAuth: () => void;
}

// SecureStore adapter for zustand/persist
const secureStorage = {
  getItem: async (name: string) => await SecureStore.getItemAsync(name),
  setItem: async (name: string, value: string) =>
    await SecureStore.setItemAsync(name, value),
  removeItem: async (name: string) => await SecureStore.deleteItemAsync(name),
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      user: null,
      role: null,
      isLoading: true,
      needsPhone: false,
      needsPasswordReset: false,

      setSession: (session) =>
        set({ session, user: session?.user ?? null, isLoading: false }),

      setRole: (role) => set({ role }),

      setNeedsPhone: (needsPhone) => set({ needsPhone }),

      setNeedsPasswordReset: (needsPasswordReset) => set({ needsPasswordReset }),

      clearAuth: () =>
        set({ session: null, user: null, role: null, isLoading: false, needsPhone: false, needsPasswordReset: false }),
    }),
    {
      name: 'hafefli-auth',
      storage: createJSONStorage(() => secureStorage),
      // Only persist what's needed — don't persist isLoading
      partialize: (state) => ({
        session: state.session,
        role: state.role,
        needsPhone: state.needsPhone,
        needsPasswordReset: state.needsPasswordReset,
      }),
    },
  ),
);
