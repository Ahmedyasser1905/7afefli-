// apps/mobile/src/store/authStore.ts

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import type { Session, User } from '@supabase/supabase-js';
import type { UserRole } from '../../packages/shared/types';

interface AuthState {
  session: Session | null;
  user: User | null;
  role: UserRole | null;
  isLoading: boolean;

  setSession: (session: Session | null) => void;
  setRole: (role: UserRole) => void;
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

      setSession: (session) =>
        set({ session, user: session?.user ?? null, isLoading: false }),

      setRole: (role) => set({ role }),

      clearAuth: () =>
        set({ session: null, user: null, role: null, isLoading: false }),
    }),
    {
      name: 'barberdz-auth',
      storage: createJSONStorage(() => secureStorage),
      // Only persist what's needed — don't persist isLoading
      partialize: (state) => ({
        session: state.session,
        role: state.role,
      }),
    },
  ),
);
