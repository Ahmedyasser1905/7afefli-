// apps/mobile/src/screens/client/BookingScreen.tsx
// 4-step booking wizard: Service → Date → Barber (optional) → Slot

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Image, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient';
import { colors, spacing, radius, shadows } from '../../theme';
import { DateStrip } from '../../components/booking/DateStrip';
import { SlotPicker } from '../../components/booking/SlotPicker';
import { useBookingStore } from '../../store/bookingStore';
import { useAuthStore } from '../../store/authStore';
import { useCreateReservation } from '../../hooks/booking/useCreateReservation';
import { scheduleAppointmentReminder } from '../../lib/notifications';
import Ionicons from "@react-native-vector-icons/ionicons";
import type { Service } from '@barberdz/shared/types';
import { useTranslations } from '../../hooks/useTranslations';

export function BookingScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { salonId, selectedServiceIds } = route.params as { salonId: string; selectedServiceIds?: string[] };

  const {
    selectedService,
    selectedDate,
    selectedBarberId,
    selectedSlot,
    currentStep,
    setService,
    setDate,
    setBarber,
    setSlot,
    nextStep,
    prevStep,
    resetBooking,
  } = useBookingStore();

  const createReservation = useCreateReservation();
  const [pendingSlot, setPendingSlot] = useState<{ startTime: string; endTime: string } | null>(null);
  
  const { user } = useAuthStore();
  const [clientPhone, setClientPhone] = useState(user?.phone || user?.user_metadata?.phone || '');
  const { t } = useTranslations();

  // Fetch salon details
  const { data: salon, isLoading: isSalonLoading } = useQuery<Record<string, unknown> | null>({
    queryKey: ['salon-booking', salonId],
    queryFn: async () => {
      const data = await apiClient.get<Record<string, unknown>>(`/salons/${salonId}`);
      return data;
    },
  });

  // Fetch services
  const { data: services = [], isLoading: isServicesLoading } = useQuery<Service[]>({
    queryKey: ['salon-services', salonId],
    queryFn: async () => {
      const data = await apiClient.get<Service[]>(`/salons/${salonId}/services`);
      return data;
    },
  });

  // Fetch client profile to pre-fill phone number
  const { data: profile } = useQuery<Record<string, unknown> | null>({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      return await apiClient.get<Record<string, unknown>>('/auth/profiles/me');
    },
    enabled: !!user,
  });

  // Pre-fill phone when profile loads
  useEffect(() => {
    if (profile?.phone_number && !clientPhone) {
      setClientPhone(profile.phone_number as string);
    }
  }, [profile?.phone_number]);

  // Fetch staff via API only — no Supabase fallback
  const { data: staff = [] } = useQuery<Record<string, unknown>[]>({
    queryKey: ['salon-staff', salonId],
    queryFn: async () => {
      return apiClient.get<Record<string, unknown>[]>(`/salons/${salonId}/staff`);
    },
  });

  // Fetch active reservations to check for Confirmed status
  const { data: myReservations = [], isLoading: isReservationsLoading } = useQuery({
    queryKey: ['my-reservations-booking-check'],
    queryFn: async () => {
      // The API wraps paginated responses in { data: [] }
      const res = await apiClient.get<any>('/reservations/me');
      return Array.isArray(res) ? res : (res?.data || []);
    },
    staleTime: 60 * 1000,
  });

  const hasConfirmedReservation = useMemo(() => {
    const today = new Date();
    const currentDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    return myReservations.some((r: any) => r.status === 'Confirmed' && r.appointment_date >= currentDateStr);
  }, [myReservations]);

  const hasPendingReservationInSameSalon = useMemo(() => {
    const today = new Date();
    const currentDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    return myReservations.some((r: any) => r.status === 'Pending' && r.salon_id === salonId && r.appointment_date >= currentDateStr);
  }, [myReservations, salonId]);

  // Sync preselected services from Salon Detail Screen → skip to Date step
  useEffect(() => {
    if (selectedServiceIds && selectedServiceIds.length > 0 && services.length > 0) {
      const matched = services.find((s) => s.id === selectedServiceIds[0]);
      if (matched) {
        setService(matched);
        // Skip service selection step, go to date
        useBookingStore.getState().setStep(1);
      }
    }
  }, [selectedServiceIds, services]);

  const handleServiceSelect = useCallback(
    (service: Service) => {
      setService(service);
      nextStep();
    },
    [setService, nextStep],
  );

  const handleDateSelect = useCallback(
    (date: string) => {
      setDate(date);
      if (staff.length === 0) {
        useBookingStore.getState().setStep(3); // Skip barber step
      } else {
        nextStep();
      }
    },
    [setDate, nextStep, staff],
  );

  const handleBarberSelect = useCallback(
    (barberId: string | null) => {
      setBarber(barberId);
      nextStep();
    },
    [setBarber, nextStep],
  );

  const handleSlotConfirm = async (slot: { startTime: string; endTime: string }) => {
    if (!selectedService || !selectedDate || !salon) return;

    try {
      const reservation = await createReservation.mutateAsync({
        salonId,
        serviceId: selectedService.id,
        staffId: selectedBarberId,
        appointmentDate: selectedDate,
        startTime: slot.startTime,
        endTime: slot.endTime,
        clientPhone: clientPhone,
      });

      // Schedule notification reminder
      await scheduleAppointmentReminder({
        id: reservation.id,
        appointment_date: selectedDate,
        start_time: slot.startTime,
        salon_name: salon.name as string,
      });

      navigation.navigate('BookingConfirm', {
        reservationId: reservation.id,
      });
    } catch (err) {
      // Handled in query hook
    }
  };

  const handleBackPress = () => {
    if (currentStep === 0 || (selectedServiceIds && currentStep === 1)) {
      resetBooking();
      navigation.goBack();
    } else {
      if (currentStep === 3) setPendingSlot(null);
      prevStep();
    }
  };

  const selectedBarber = useMemo(() => {
    if (!selectedBarberId) return null;
    return staff.find((s: Record<string, unknown>) => s.id === selectedBarberId);
  }, [selectedBarberId, staff]);

  if (isSalonLoading || isServicesLoading || isReservationsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.amber} size="large" />
      </View>
    );
  }

  if (hasConfirmedReservation) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerBar}>
          <TouchableOpacity style={styles.backButton} onPress={handleBackPress} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={colors.amber} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('booking.title')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={[styles.emptyState, { flex: 1, justifyContent: 'center' }]}>
          <Ionicons name="calendar-outline" size={64} color="#EAB308" />
          <Text style={[styles.emptyTitle, { marginTop: spacing.md }]}>{t('booking.active_reservation')}</Text>
          <Text style={[styles.emptySubtitle, { marginHorizontal: spacing.xl, textAlign: 'center' }]}>
            {t('booking.already_confirmed')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (hasPendingReservationInSameSalon) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerBar}>
          <TouchableOpacity style={styles.backButton} onPress={handleBackPress} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={colors.amber} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('booking.title')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={[styles.emptyState, { flex: 1, justifyContent: 'center' }]}>
          <Ionicons name="time-outline" size={64} color="#3B82F6" />
          <Text style={[styles.emptyTitle, { marginTop: spacing.md }]}>{t('booking.pending_request')}</Text>
          <Text style={[styles.emptySubtitle, { marginHorizontal: spacing.xl, textAlign: 'center' }]}>
            {t('booking.already_pending')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (salon && salon.is_manually_closed) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerBar}>
          <TouchableOpacity style={styles.backButton} onPress={handleBackPress} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={colors.amber} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('booking.title')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={[styles.emptyState, { flex: 1, justifyContent: 'center' }]}>
          <Ionicons name="close-circle-outline" size={64} color="#EF4444" />
          <Text style={[styles.emptyTitle, { marginTop: spacing.md }]}>{t('booking.salon_closed')}</Text>
          <Text style={[styles.emptySubtitle, { marginHorizontal: spacing.xl }]}>
            {t('booking.salon_closed_detail')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const STEPS = [t('booking.step_service'), t('booking.step_date'), t('booking.step_barber'), t('booking.step_slot')];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={colors.amber} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('booking.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Step Indicator */}
      <View style={styles.stepIndicatorContainer}>
        {STEPS.map((label, i) => {
          const isActive = i === currentStep;
          const isCompleted = i < currentStep;

          return (
            <View key={label} style={styles.stepItem}>
              <View
                style={[
                  styles.stepDot,
                  isActive && styles.stepDotActive,
                  isCompleted && styles.stepDotCompleted,
                ]}
              >
                {isCompleted ? (
                  <Ionicons name="checkmark" size={12} color={colors.ink} />
                ) : (
                  <Text style={[styles.stepNum, isActive && styles.stepNumActive]}>
                    {i + 1}
                  </Text>
                )}
              </View>
              <Text style={[styles.stepLabel, isActive && styles.stepLabelActive]}>
                {label}
              </Text>
            </View>
          );
        })}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Step 0: Select Service */}
        {currentStep === 0 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepHeading}>{t('booking.select_service')}</Text>
            {services.map((service) => (
              <TouchableOpacity
                key={service.id}
                style={[
                  styles.serviceCard,
                  selectedService?.id === service.id && styles.serviceCardSelected,
                ]}
                onPress={() => handleServiceSelect(service)}
                activeOpacity={0.8}
              >
                <View style={styles.serviceTextCol}>
                  <Text style={styles.serviceName}>{service.service_name}</Text>
                  <Text style={styles.serviceDesc}>{service.duration_minutes} min</Text>
                </View>
                <Text style={styles.servicePrice}>{service.price} DZD</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Step 1: Select Date */}
        {currentStep === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepHeading}>{t('booking.select_date')}</Text>
            <DateStrip selectedDate={selectedDate} onDateSelect={handleDateSelect} />
          </View>
        )}

        {/* Step 2: Select Barber (optional) */}
        {currentStep === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepHeading}>{t('booking.select_barber')}</Text>

            {/* Any barber option */}
            <TouchableOpacity
              style={[
                styles.barberCard,
                selectedBarberId === null && styles.barberCardSelected,
              ]}
              onPress={() => handleBarberSelect(null)}
              activeOpacity={0.8}
            >
              <View style={styles.barberAvatarCircle}>
                <Ionicons name="people" size={20} color={colors.textPrimary} />
              </View>
              <View style={styles.barberInfo}>
                <Text style={styles.barberName}>{t('booking.any_barber')}</Text>
                <Text style={styles.barberRole}>{t('booking.any_barber_sub')}</Text>
              </View>
              <View style={styles.selectionDot}>
                {selectedBarberId === null && <View style={styles.innerDot} />}
              </View>
            </TouchableOpacity>

            {/* Staff list */}
            {staff.map((s: Record<string, unknown>) => (
              <TouchableOpacity
                key={s.id as string}
                style={[
                  styles.barberCard,
                  selectedBarberId === s.id && styles.barberCardSelected,
                ]}
                onPress={() => handleBarberSelect(s.id as string | null)}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: (s.avatar_url as string) || (s.profiles as Record<string,unknown>)?.avatar_url as string || 'https://phfwutugsyiutqgippqg.supabase.co/storage/v1/object/public/portfolio/defaults/default-avatar.png' }}
                  style={styles.barberAvatar}
                />
                <View style={styles.barberInfo}>
                  <Text style={styles.barberName}>{(s.custom_name as string) || ((s.profiles as Record<string,unknown>)?.full_name as string) || t('booking.barber_default')}</Text>
                  <Text style={styles.barberRole}>{t('booking.barber_role')}</Text>
                </View>
                <View style={styles.selectionDot}>
                  {selectedBarberId === s.id && <View style={styles.innerDot} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Step 3: Select Time Slot */}
        {currentStep === 3 && salon && selectedService && selectedDate && (
          <View style={styles.stepContent}>
            {/* Header info about the current setup */}
            <View style={styles.summaryBar}>
              <Ionicons name="calendar-sharp" size={16} color={colors.amber} />
              <Text style={styles.summaryBarText}>
                {selectedService.service_name} • {selectedDate}
                {selectedBarber ? ` • ${(selectedBarber.custom_name as string) || ((selectedBarber.profiles as Record<string,unknown>)?.full_name as string)}` : ''}
              </Text>
            </View>

            <Text style={styles.stepHeading}>{t('booking.select_time')}</Text>

            <View style={styles.phoneInputContainer}>
              <Ionicons name="call-outline" size={18} color={colors.amber} />
              <TextInput
                style={styles.phoneInput}
                placeholder={t('booking.phone_placeholder')}
                placeholderTextColor={colors.textMuted}
                value={clientPhone}
                onChangeText={setClientPhone}
                keyboardType="phone-pad"
                maxLength={15}
              />
            </View>

            <SlotPicker
              salonId={salonId}
              serviceId={selectedService.id}
              date={selectedDate}
              staffId={selectedBarberId ?? undefined}
              openTime={(salon.open_time as string).substring(0, 5)}
              closeTime={(salon.close_time as string).substring(0, 5)}
              durationMin={selectedService.duration_minutes}
              workingDays={salon.working_days as number[] | undefined}
              onConfirm={handleSlotConfirm}
              onSlotSelect={setPendingSlot}
            />
          </View>
        )}
      </ScrollView>

      {/* Sticky bottom bar with confirm on Time Slot selection step */}
      {currentStep === 3 && selectedService && selectedDate && (
        <View style={styles.confirmFooter}>
          <View style={styles.footerPriceCol}>
            <Text style={styles.footerPriceLabel}>{t('booking.total')}</Text>
            <Text style={styles.footerPriceValue}>{selectedService.price} DZD</Text>
          </View>
          {pendingSlot && clientPhone.trim().length >= 8 ? (
            <TouchableOpacity
              style={[
                styles.footerConfirmBtn,
                createReservation.isPending && styles.footerConfirmBtnDisabled,
              ]}
              onPress={() => {
                // Guard against double-tap: if a request is already in flight, ignore
                if (createReservation.isPending) return;
                handleSlotConfirm(pendingSlot);
              }}
              activeOpacity={0.8}
              disabled={createReservation.isPending}
            >
              {createReservation.isPending ? (
                <ActivityIndicator size="small" color={colors.ink} />
              ) : (
                <>
                  <Text style={styles.footerConfirmBtnText}>{t('booking.confirm')} {pendingSlot.startTime}</Text>
                  <Ionicons name="arrow-forward" size={18} color={colors.ink} />
                </>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.footerDateCol}>
              <Text style={styles.footerTimeHint}>
                {pendingSlot ? t('booking.enter_phone_hint') : t('booking.choose_slot_hint')}
              </Text>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.ink,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 20,
    color: colors.textPrimary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  headerBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 18,
    color: colors.textPrimary,
  },
  stepIndicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
    backgroundColor: colors.carbon,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  stepItem: {
    alignItems: 'center',
    gap: 4,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.graphite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: colors.amber,
  },
  stepDotCompleted: {
    backgroundColor: colors.success,
  },
  stepNum: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 11,
    color: colors.textSecondary,
  },
  stepNumActive: {
    color: colors.ink,
  },
  stepLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 10,
    color: colors.textMuted,
  },
  stepLabelActive: {
    color: colors.amber,
  },
  content: {
    flex: 1,
  },
  stepContent: {
    padding: spacing.lg,
  },
  stepHeading: {
    fontFamily: 'Syne_700Bold',
    fontSize: 20,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  serviceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.carbon,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  serviceCardSelected: {
    borderColor: colors.amber,
    backgroundColor: '#1E1A14',
  },
  serviceTextCol: {
    flex: 1,
    marginRight: spacing.md,
  },
  serviceName: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  serviceDesc: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  servicePrice: {
    fontFamily: 'Syne_700Bold',
    fontSize: 16,
    color: colors.amber,
  },
  barberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.carbon,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  barberCardSelected: {
    borderColor: colors.amber,
    backgroundColor: '#1E1A14',
  },
  barberAvatarCircle: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.graphite,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  barberAvatar: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.graphite,
    marginRight: spacing.md,
  },
  barberInfo: {
    flex: 1,
  },
  barberName: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    color: colors.textPrimary,
  },
  barberRole: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  selectionDot: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerDot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.amber,
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(232, 160, 32, 0.08)',
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    gap: 8,
    marginBottom: spacing.lg,
  },
  summaryBarText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    color: colors.amber,
  },
  confirmFooter: {
    backgroundColor: colors.carbon,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerPriceCol: {
    flex: 1,
  },
  footerPriceLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  footerPriceValue: {
    fontFamily: 'Syne_700Bold',
    fontSize: 18,
    color: colors.amber,
    marginTop: 2,
  },
  footerDateCol: {
    alignItems: 'flex-end',
  },
  footerTimeHint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
  },
  footerConfirmBtn: {
    backgroundColor: colors.amber,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    elevation: 4,
    shadowColor: colors.amber,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  footerConfirmBtnDisabled: {
    opacity: 0.6,
    elevation: 0,
  },
  footerConfirmBtnText: {
    fontFamily: 'Syne_700Bold',
    fontSize: 14,
    color: colors.ink,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.carbon,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 52,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: spacing.sm,
  },
  phoneInput: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
  },
});
