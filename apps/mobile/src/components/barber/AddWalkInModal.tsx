// apps/mobile/src/components/barber/AddWalkInModal.tsx
import React, { useState } from 'react';
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

interface AddWalkInModalProps {
  visible: boolean;
  onClose: () => void;
  salonId: string;
  onSuccess: () => void;
}

export function AddWalkInModal({ visible, onClose, salonId, onSuccess }: AddWalkInModalProps) {
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    clientName: '',
    phone: '',
    time: '10:00',
    notes: '',
  });
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  const { data: services = [] } = useQuery({
    queryKey: ['salon-services', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('salon_id', salonId);
      if (error) throw error;
      return data;
    },
    enabled: visible && !!salonId,
  });

  const handleSubmit = async () => {
    if (!form.clientName || !form.time || !selectedServiceId) {
      Alert.alert('Erreur', 'Veuillez remplir le nom, choisir un service et indiquer l\'heure');
      return;
    }

    setLoading(true);
    try {
      const service = services.find(s => s.id === selectedServiceId);
      const durationMin = service?.duration_minutes || 30;
      
      // Calculate end time
      const [h, m] = form.time.split(':').map(Number);
      const endM = m + durationMin;
      const endH = h + Math.floor(endM / 60);
      const finalEndM = endM % 60;
      const endTime = `${String(endH).padStart(2, '0')}:${String(finalEndM).padStart(2, '0')}`;

      const { error } = await supabase.from('reservations').insert({
        salon_id: salonId,
        client_id: user?.id, // Use barber's ID as placeholder for walk-in client relation
        barber_id: user?.id,
        service_id: selectedServiceId,
        appointment_date: new Date().toISOString().split('T')[0], // Today
        start_time: form.time,
        end_time: endTime,
        status: 'Confirmed',
        notes: `[Sans RDV] Client: ${form.clientName}${form.phone ? ` - Tel: ${form.phone}` : ''}${form.notes ? `\nNotes: ${form.notes}` : ''}`,
      });

      if (error) throw error;
      
      onSuccess();
      setForm({ clientName: '', phone: '', time: '10:00', notes: '' });
      setSelectedServiceId(null);
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
                  onPress={() => setSelectedServiceId(service.id)}
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

            <Text style={styles.label}>Heure</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 14:30"
              placeholderTextColor={colors.textMuted}
              value={form.time}
              onChangeText={(t) => setForm({ ...form, time: t })}
            />

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
