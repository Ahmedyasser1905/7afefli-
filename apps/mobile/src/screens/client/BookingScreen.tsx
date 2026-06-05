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
import { useCreateReservation } from '../../hooks/booking/useCreateReservation';
import { scheduleAppointmentReminder } from '../../lib/notifications';
import Ionicons from "@react-native-vector-icons/ionicons";
import type { Service } from '@barberdz/shared/types';

export function BookingScreen() {
  const route = useRoute<Record<string, unknown>>();
  const navigation = useNavigation<Record<string, unknown>>();
  const { salonId, selectedServiceIds } = route.params;

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
  const [clientPhone, setClientPhone] = useState('');

  // Fetch salon details
  const { data: salon, isLoading: isSalonLoading } = useQuery({
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

  // Fetch staff via API only — no Supabase fallback
  const { data: staff = [] } = useQuery<Record<string, unknown>[]>({
    queryKey: ['salon-staff', salonId],
    queryFn: async () => {
      return apiClient.get<Record<string, unknown>[]>(`/salons/${salonId}/staff`);
    },
  });

  // Sync preselected services from Salon Detail Screen → skip to Date step
  useEffect(() => {
    if (selectedServiceIds && selectedServiceIds.length > 0 && services.length > 0) {
      const matched = services.find((s) => s.id === selectedServiceIds[0]);
      if (matched) {
        setService(matched);
        // Skip service selection step, go to date
        useBookingStore.setState({ currentStep: 1 });
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
        useBookingStore.setState({ currentStep: 3 }); // Skip barber step
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
        salon_name: salon.name,
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

  if (isSalonLoading || isServicesLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.amber} size="large" />
      </View>
    );
  }

  const STEPS = ['Service', 'Date', 'Barbier', 'Créneau'];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={colors.amber} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Réservation</Text>
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
            <Text style={styles.stepHeading}>Sélectionnez un service</Text>
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
            <Text style={styles.stepHeading}>Sélectionnez une date</Text>
            <DateStrip selectedDate={selectedDate} onDateSelect={handleDateSelect} />
          </View>
        )}

        {/* Step 2: Select Barber (optional) */}
        {currentStep === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepHeading}>Choisissez votre coiffeur</Text>

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
                <Text style={styles.barberName}>N'importe quel coiffeur</Text>
                <Text style={styles.barberRole}>Option la plus rapide</Text>
              </View>
              <View style={styles.selectionDot}>
                {selectedBarberId === null && <View style={styles.innerDot} />}
              </View>
            </TouchableOpacity>

            {/* Staff list */}
            {staff.map((s: Record<string, unknown>) => (
              <TouchableOpacity
                key={s.id}
                style={[
                  styles.barberCard,
                  selectedBarberId === s.id && styles.barberCardSelected,
                ]}
                onPress={() => handleBarberSelect(s.id)}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: s.avatar_url || s.profiles?.avatar_url || 'https://lh3.googleusercontent.com/aida-public/AB6AXuBRQWg_Xc-hckv32TMl23w3Cmwd60Jfa3onMRJmyq2rdcvXoTRgGi6On2KOEVTvmrS9-SbemMGS51_LEHQs1ZxegGjSR4DZA3jucMor_wY0Pxy60Z3HTFdJCRlAu-rdbbhw6Sr3Ij91hYl0I8ekc8OVsjNYqWXvUGUW8s_w6Jj3MMwDInwYRhYBiVAuft8ggvfn0pVY7IOHZmM99GtHingFPzXsqQxHIG8ereW05P_VCWdAd9cuxZHbd9-TMAwJBAzB50_1gIsUU5k-' }}
                  style={styles.barberAvatar}
                />
                <View style={styles.barberInfo}>
                  <Text style={styles.barberName}>{s.custom_name || s.profiles?.full_name || 'Barbier'}</Text>
                  <Text style={styles.barberRole}>Coiffeur professionnel</Text>
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
                {selectedBarber ? ` • ${selectedBarber.custom_name || selectedBarber.profiles?.full_name}` : ''}
              </Text>
            </View>

            <Text style={styles.stepHeading}>Sélectionnez un créneau</Text>

            <View style={styles.phoneInputContainer}>
              <Ionicons name="call-outline" size={18} color={colors.amber} />
              <TextInput
                style={styles.phoneInput}
                placeholder="Votre numéro de téléphone"
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
              openTime={salon.open_time.substring(0, 5)}
              closeTime={salon.close_time.substring(0, 5)}
              durationMin={selectedService.duration_minutes}
              workingDays={salon.working_days}
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
            <Text style={styles.footerPriceLabel}>Total</Text>
            <Text style={styles.footerPriceValue}>{selectedService.price} DZD</Text>
          </View>
          {pendingSlot && clientPhone.trim().length >= 8 ? (
            <TouchableOpacity
              style={styles.footerConfirmBtn}
              onPress={() => handleSlotConfirm(pendingSlot)}
              activeOpacity={0.8}
            >
              <Text style={styles.footerConfirmBtnText}>Confirmer {pendingSlot.startTime}</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.ink} />
            </TouchableOpacity>
          ) : (
            <View style={styles.footerDateCol}>
              <Text style={styles.footerTimeHint}>
                {pendingSlot ? "Entrez votre téléphone ↑" : "Choisissez un créneau ↑"}
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
