// apps/mobile/src/screens/client/BookingScreen.tsx
// 4-step booking wizard: Service → Date → Barber (optional) → Slot

import React, { useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, FlatList, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { colors, typography, spacing, radius } from '../../theme';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { Card } from '../../components/ui/Card';
import { ServiceCard } from '../../components/booking/ServiceCard';
import { DateStrip } from '../../components/booking/DateStrip';
import { SlotPicker } from '../../components/booking/SlotPicker';
import { useBookingStore } from '../../store/bookingStore';
import { useCreateReservation } from '../../hooks/booking/useCreateReservation';
import { scheduleAppointmentReminder } from '../../lib/notifications';
import type { Service, TimeSlot } from '../../../../packages/shared/types';

export function BookingScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { salonId } = route.params;

  const {
    selectedService,
    selectedDate,
    selectedBarberId,
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

  // Fetch salon details (for open/close time)
  const { data: salon } = useQuery({
    queryKey: ['salon-booking', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salons')
        .select('id, name, open_time, close_time, working_days')
        .eq('id', salonId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch services
  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ['salon-services', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('salon_id', salonId)
        .eq('is_active', true)
        .order('price', { ascending: true });
      if (error) throw error;
      return data as Service[];
    },
  });

  // Fetch staff (for optional barber selection)
  const { data: staff = [] } = useQuery({
    queryKey: ['salon-staff', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salon_staff')
        .select('*, profiles:profile_id (full_name, avatar_url)')
        .eq('salon_id', salonId);
      if (error) throw error;
      return data ?? [];
    },
  });

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
      // Skip barber step if no multi-staff
      if (staff.length === 0) {
        useBookingStore.setState({ currentStep: 3 });
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

  const handleSlotConfirm = useCallback(
    async (slot: { startTime: string; endTime: string }) => {
      if (!selectedService || !selectedDate || !salon) return;

      Alert.alert(
        'Confirmer la réservation',
        `${selectedService.service_name}\n${selectedDate} · ${slot.startTime} – ${slot.endTime}`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Confirmer',
            onPress: async () => {
              try {
                const reservation = await createReservation.mutateAsync({
                  salonId,
                  serviceId: selectedService.id,
                  barberId: selectedBarberId,
                  appointmentDate: selectedDate,
                  startTime: slot.startTime,
                  endTime: slot.endTime,
                });

                // Schedule push notification reminder
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
                // Error handled by mutation onError
              }
            },
          },
        ],
      );
    },
    [selectedService, selectedDate, selectedBarberId, salon, salonId, navigation],
  );

  const STEPS = ['Service', 'Date', 'Barbier', 'Créneau'];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Button
          title="←"
          variant="ghost"
          onPress={() => {
            if (currentStep === 0) {
              resetBooking();
              navigation.goBack();
            } else {
              prevStep();
            }
          }}
        />
        <Text style={styles.headerTitle}>Réserver</Text>
        <View style={{ width: 48 }} />
      </View>

      {/* Step Indicator */}
      <View style={styles.stepIndicator}>
        {STEPS.map((label, i) => (
          <View key={label} style={styles.stepItem}>
            <View
              style={[
                styles.stepDot,
                i <= currentStep && styles.stepDotActive,
                i < currentStep && styles.stepDotCompleted,
              ]}
            >
              <Text style={[styles.stepNum, i <= currentStep && styles.stepNumActive]}>
                {i < currentStep ? '✓' : i + 1}
              </Text>
            </View>
            <Text style={[styles.stepLabel, i === currentStep && styles.stepLabelActive]}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      {/* Step Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Step 0: Select Service */}
        {currentStep === 0 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Choisir un service</Text>
            {services.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                isSelected={selectedService?.id === service.id}
                onSelect={handleServiceSelect}
              />
            ))}
          </View>
        )}

        {/* Step 1: Select Date */}
        {currentStep === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Choisir une date</Text>
            <DateStrip selectedDate={selectedDate} onDateSelect={handleDateSelect} />
          </View>
        )}

        {/* Step 2: Select Barber (optional) */}
        {currentStep === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Choisir un barbier</Text>
            <Card
              style={[
                styles.barberCard,
                selectedBarberId === null && styles.barberCardSelected,
              ]}
            >
              <Button
                title="N'importe quel barbier"
                variant={selectedBarberId === null ? 'primary' : 'secondary'}
                onPress={() => handleBarberSelect(null)}
                fullWidth
              />
            </Card>
            {staff.map((s: any) => (
              <Card
                key={s.id}
                style={[
                  styles.barberCard,
                  selectedBarberId === s.profile_id && styles.barberCardSelected,
                ]}
              >
                <View style={styles.barberRow}>
                  <Avatar
                    uri={s.profiles?.avatar_url}
                    name={s.profiles?.full_name ?? 'Barbier'}
                    size={48}
                  />
                  <View style={styles.barberInfo}>
                    <Text style={styles.barberName}>
                      {s.profiles?.full_name ?? 'Barbier'}
                    </Text>
                    <Text style={styles.barberRole}>{s.role}</Text>
                  </View>
                  <Button
                    title="Choisir"
                    variant={selectedBarberId === s.profile_id ? 'primary' : 'secondary'}
                    onPress={() => handleBarberSelect(s.profile_id)}
                  />
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* Step 3: Select Time Slot */}
        {currentStep === 3 && salon && selectedService && selectedDate && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Choisir un créneau</Text>
            <SlotPicker
              salonId={salonId}
              serviceId={selectedService.id}
              date={selectedDate}
              barberId={selectedBarberId ?? undefined}
              openTime={salon.open_time.substring(0, 5)}
              closeTime={salon.close_time.substring(0, 5)}
              durationMin={selectedService.duration_minutes}
              onConfirm={handleSlotConfirm}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.graphite,
  },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  stepIndicator: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: spacing.md, paddingHorizontal: spacing.sm,
    backgroundColor: colors.carbon,
  },
  stepItem: { alignItems: 'center', gap: spacing.xs },
  stepDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.graphite,
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: colors.amber },
  stepDotCompleted: { backgroundColor: colors.success },
  stepNum: { ...typography.caption, color: colors.textMuted, fontFamily: 'DMSans_700Bold' },
  stepNumActive: { color: colors.ink },
  stepLabel: { ...typography.caption, color: colors.textMuted },
  stepLabelActive: { color: colors.amber },
  content: { flex: 1 },
  stepContent: { padding: spacing.lg, gap: spacing.md },
  stepTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.sm },
  barberCard: { marginBottom: spacing.sm },
  barberCardSelected: { borderWidth: 1, borderColor: colors.amber },
  barberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  barberInfo: { flex: 1 },
  barberName: { ...typography.bodyMd, color: colors.textPrimary, fontFamily: 'DMSans_500Medium' },
  barberRole: { ...typography.caption, color: colors.textSecondary },
});
