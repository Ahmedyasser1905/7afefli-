// apps/mobile/src/store/bookingStore.ts

import { create } from 'zustand';
import type { Salon, Service, TimeSlot } from '@barberdz/shared/types';

interface BookingState {
  // Step 1: Salon
  selectedSalon: Salon | null;
  // Step 2: Service
  selectedService: Service | null;
  // Step 3: Date
  selectedDate: string | null; // ISO: "2025-07-15"
  // Step 4: Barber (optional)
  selectedBarberId: string | null;
  // Step 5: Slot
  selectedSlot: TimeSlot | null;
  // Current step
  currentStep: number;
  clientPhone: string;

  setSalon: (salon: Salon) => void;
  setService: (service: Service) => void;
  setDate: (date: string) => void;
  setBarber: (id: string | null) => void;
  setSlot: (slot: TimeSlot) => void;
  setStep: (step: number) => void;
  setPhone: (phone: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  resetBooking: () => void;
}

export const useBookingStore = create<BookingState>((set) => ({
  selectedSalon: null,
  selectedService: null,
  selectedDate: null,
  selectedBarberId: null,
  selectedSlot: null,
  currentStep: 0,
  clientPhone: '',

  setSalon: (salon) => set({ selectedSalon: salon }),
  setService: (service) => set({ selectedService: service }),
  setDate: (date) => set({ selectedDate: date }),
  setBarber: (id) => set({ selectedBarberId: id }),
  setSlot: (slot) => set({ selectedSlot: slot }),
  setStep: (step) => set({ currentStep: step }),
  setPhone: (phone) => set({ clientPhone: phone }),
  nextStep: () => set((s) => ({ currentStep: Math.min(s.currentStep + 1, 3) })),
  prevStep: () => set((s) => ({ currentStep: Math.max(s.currentStep - 1, 0) })),

  resetBooking: () =>
    set({
      selectedSalon: null,
      selectedService: null,
      selectedDate: null,
      selectedBarberId: null,
      selectedSlot: null,
      currentStep: 0,
      clientPhone: '',
    }),
}));
