// apps/mobile/src/components/barber/AddWalkInModal.tsx
import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { colors, radius, spacing } from '../../theme';
import Ionicons from "@react-native-vector-icons/ionicons";
import { formatDZD } from '@barberdz/shared/utils/formatters';
import { apiClient } from '../../lib/apiClient';
import { useAvailableSlots } from '../../hooks/booking/useAvailableSlots';

interface AddWalkInModalProps {
  visible: boolean;
  onClose: () => void;
  salonId: string;
  onSuccess: () => void;
}

const getLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function AddWalkInModal({ visible, onClose, salonId, onSuccess }: AddWalkInModalProps) {
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    clientName: '',
    phone: '',
    notes: '',
  });
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);

  // Fetch salon details
  const { data: salon } = useQuery<any>({
    queryKey: ['barber-salon-details', salonId],
    queryFn: async () => {
      return apiClient.get<any>(`/salons/${salonId}`);
    },
    enabled: visible && !!salonId,
  });

  // Fetch staff list
  const { data: staffList = [] } = useQuery<any[]>({
    queryKey: ['salon-staff', salonId],
    queryFn: async () => {
      return apiClient.get<any[]>(`/salons/${salonId}/staff`);
    },
    enabled: visible && !!salonId,
  });

  // Fetch services
  const { data: services = [] } = useQuery({
    queryKey: ['salon-services', salonId],
    queryFn: async () => {
      const data = await apiClient.get<Record<string, unknown>[]>(`/salons/${salonId}/services`);
      return data;
    },
    enabled: visible && !!salonId,
  });

  // Pre-select the current user in the staff list if they are in it
  useEffect(() => {
    if (staffList.length > 0 && !selectedStaffId && user?.id) {
      const currentBarber = staffList.find(s => s.profile_id === user.id);
      if (currentBarber) {
        setSelectedStaffId(currentBarber.id);
      }
    }
  }, [staffList, user?.id, selectedStaffId]);

  const selectedService = services.find(s => s.id === selectedServiceId);
  const todayStr = getLocalDateString();

  // Query Available Slots
  const { data: slots = [], isLoading: isSlotsLoading } = useAvailableSlots({
    salonId,
    serviceId: selectedServiceId,
    date: todayStr,
    staffId: selectedStaffId,
    openTime: salon?.open_time ? salon.open_time.substring(0, 5) : '09:00',
    closeTime: salon?.close_time ? salon.close_time.substring(0, 5) : '21:00',
    durationMin: selectedService?.duration_minutes || 30,
    workingDays: salon?.working_days || [1, 2, 3, 4, 5, 6],
  });

  const handleSubmit = async () => {
    if (!form.clientName || !selectedTimeSlot || !selectedServiceId || !selectedStaffId) {
      Alert.alert('Erreur', 'Veuillez remplir le nom, choisir un service, un coiffeur et indiquer l\'heure');
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        salonId,
        serviceId: selectedServiceId,
        appointmentDate: todayStr,
        startTime: selectedTimeSlot,
        barberId: selectedStaffId,
        notes: `[Sans RDV] Client: ${form.clientName}${form.notes ? `\nNotes: ${form.notes}` : ''}`,
      };

      if (form.phone && form.phone.trim().length > 0) {
        payload.clientPhone = form.phone.trim();
      }

      const res = await apiClient.post<Record<string, unknown>>('/reservations', payload);
      await apiClient.patch(`/reservations/${res.id}/status`, { status: 'Confirmed' });
      
      onSuccess();
      setForm({ clientName: '', phone: '', notes: '' });
      setSelectedServiceId(null);
      setSelectedStaffId(null);
      setSelectedTimeSlot(null);
      onClose();
    } catch (err: any) {
      if (err.message && err.message.includes('booking_conflict')) {
        Alert.alert('Erreur', 'Ce créneau est déjà réservé par un autre client ou bloqué.');
      } else {
        Alert.alert('Erreur', err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Ajouter un client</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Nom du client</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Amine"
              placeholderTextColor={colors.textMuted}
              value={form.clientName}
              onChangeText={(t) => setForm({ ...form, clientName: t })}
            />

            <Text style={styles.label}>Téléphone</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 0555..."
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              value={form.phone}
              onChangeText={(t) => setForm({ ...form, phone: t })}
            />

            <Text style={styles.label}>Service</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.servicesScroll}>
              {services.map(service => (
                <TouchableOpacity
                  key={service.id}
                  style={[
                    styles.serviceChip,
                    selectedServiceId === service.id && styles.serviceChipSelected
                  ]}
                  onPress={() => {
                    setSelectedServiceId(service.id);
                    setSelectedTimeSlot(null); // Clear selected slot when service changes
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.serviceName,
                    selectedServiceId === service.id && styles.textInk
                  ]}>
                    {service.service_name}
                  </Text>
                  <Text style={[
                    styles.servicePrice,
                    selectedServiceId === service.id && styles.textInk
                  ]}>
                    {formatDZD(service.price)} • {service.duration_minutes} min
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Coiffeur (Barbier)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.servicesScroll}>
              {staffList.map(staff => {
                const isSelected = selectedStaffId === staff.id;
                const displayName = staff.custom_name || staff.profiles?.full_name || 'Barbier';
                return (
                  <TouchableOpacity
                    key={staff.id}
                    style={[
                      styles.serviceChip,
                      isSelected && styles.serviceChipSelected
                    ]}
                    onPress={() => {
                      setSelectedStaffId(staff.id);
                      setSelectedTimeSlot(null); // Clear selected slot when staff changes
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[
                      styles.serviceName,
                      isSelected && styles.textInk
                    ]}>
                      {displayName}
                    </Text>
                    <Text style={[
                      styles.servicePrice,
                      isSelected && styles.textInk
                    ]}>
                      {staff.role || 'Coiffeur'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.label}>Heures disponibles</Text>
            {isSlotsLoading ? (
              <ActivityIndicator color={colors.amber} style={{ marginVertical: spacing.md }} />
            ) : !selectedServiceId ? (
              <Text style={styles.emptyText}>Veuillez d'abord choisir un service</Text>
            ) : !selectedStaffId ? (
              <Text style={styles.emptyText}>Veuillez d'abord choisir un coiffeur</Text>
            ) : slots.length === 0 ? (
              <Text style={styles.emptyText}>Aucun créneau disponible pour aujourd'hui</Text>
            ) : (
              <View style={styles.slotsGrid}>
                {slots.map(slot => {
                  const isSelected = selectedTimeSlot === slot.startTime;
                  const isAvailable = slot.isAvailable;
                  return (
                    <TouchableOpacity
                      key={slot.startTime}
                      style={[
                        styles.slotButton,
                        !isAvailable && styles.slotButtonDisabled,
                        isSelected && styles.slotButtonSelected
                      ]}
                      disabled={!isAvailable}
                      onPress={() => setSelectedTimeSlot(slot.startTime)}
                      activeOpacity={0.8}
                    >
                      <Text style={[
                        styles.slotText,
                        !isAvailable && styles.slotTextDisabled,
                        isSelected && styles.textInk
                      ]}>
                        {slot.startTime}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <Text style={styles.label}>Notes (Optionnel)</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Détails de la coupe..."
              placeholderTextColor={colors.textMuted}
              multiline
              value={form.notes}
              onChangeText={(t) => setForm({ ...form, notes: t })}
            />

            <View style={styles.buttons}>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
                {loading ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.submitBtnText}>Enregistrer le RDV</Text>}
              </TouchableOpacity>
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: colors.ink,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.xl,
    paddingBottom: spacing.sm,
  },
  title: {
    fontFamily: 'Syne_700Bold',
    fontSize: 20,
    color: colors.textPrimary,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  scrollArea: {
    paddingHorizontal: spacing.xl,
  },
  label: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: colors.carbon,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    fontFamily: 'DMSans_400Regular',
  },
  servicesScroll: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  serviceChip: {
    backgroundColor: colors.carbon,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.md,
    padding: spacing.md,
    marginRight: spacing.sm,
    minWidth: 140,
  },
  serviceChipSelected: {
    backgroundColor: colors.amber,
    borderColor: colors.amber,
  },
  serviceName: {
    fontFamily: 'Syne_700Bold',
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  servicePrice: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
  },
  textInk: {
    color: colors.ink,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  slotButton: {
    width: '22%',
    paddingVertical: spacing.sm,
    backgroundColor: colors.carbon,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  slotButtonSelected: {
    backgroundColor: colors.amber,
    borderColor: colors.amber,
  },
  slotButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderColor: 'transparent',
    opacity: 0.3,
  },
  slotText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    color: colors.textPrimary,
  },
  slotTextDisabled: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  emptyText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: colors.textMuted,
    marginVertical: spacing.sm,
  },
  buttons: {
    marginTop: spacing.xl,
  },
  submitBtn: {
    width: '100%',
    padding: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.amber,
    height: 52,
    justifyContent: 'center',
  },
  submitBtnText: {
    color: colors.ink,
    fontFamily: 'Syne_700Bold',
    fontSize: 16,
  },
});
