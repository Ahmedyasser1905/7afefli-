import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';
import Ionicons from '@react-native-vector-icons/ionicons';
import { supabase } from '../../lib/supabase';

interface BlockTimeModalProps {
  visible: boolean;
  onClose: () => void;
  salonId: string;
  userId: string;
  onSuccess: () => void;
}

export function BlockTimeModal({ visible, onClose, salonId, userId, onSuccess }: BlockTimeModalProps) {
  const [time, setTime] = useState('15:00');
  const [endTime, setEndTime] = useState('16:00');
  const [loading, setLoading] = useState(false);

  const handleBlock = async () => {
    if (!time || !endTime) {
      Alert.alert('Erreur', 'Veuillez entrer une heure de début et de fin');
      return;
    }
    
    // validate time format HH:MM
    if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time) || !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(endTime)) {
      Alert.alert('Erreur', "Format d'heure invalide. Utilisez HH:MM (ex: 15:00)");
      return;
    }

    if (time >= endTime) {
      Alert.alert('Erreur', "L'heure de fin doit être après l'heure de début.");
      return;
    }

    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase.from('reservations').insert({
        salon_id: salonId,
        client_id: userId,
        barber_id: userId,
        appointment_date: today,
        start_time: time,
        end_time: endTime,
        status: 'Confirmed',
        notes: 'CRÉNEAU BLOQUÉ',
      });

      if (error) throw error;
      
      onSuccess();
      setTime('15:00');
      setEndTime('16:00');
      onClose();
    } catch (err: any) {
      if (err.message && err.message.includes('booking_conflict')) {
        Alert.alert('Erreur', 'Il y a déjà une réservation pendant ce créneau.');
      } else {
        Alert.alert('Erreur', err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Bloquer un créneau</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <Text style={styles.label}>Heure de début (ex: 15:00)</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="time-outline" size={20} color={colors.amber} />
              <TextInput
                style={styles.input}
                value={time}
                onChangeText={setTime}
                placeholder="15:00"
                placeholderTextColor={colors.textMuted}
                keyboardType="numbers-and-punctuation"
              />
            </View>

            <Text style={styles.label}>Heure de fin (ex: 16:00)</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="time-outline" size={20} color={colors.amber} />
              <TextInput
                style={styles.input}
                value={endTime}
                onChangeText={setEndTime}
                placeholder="16:00"
                placeholderTextColor={colors.textMuted}
                keyboardType="numbers-and-punctuation"
              />
            </View>

            <TouchableOpacity 
              style={styles.submitBtn} 
              onPress={handleBlock}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.ink} />
              ) : (
                <>
                  <Ionicons name="lock-closed" size={20} color={colors.ink} />
                  <Text style={styles.submitBtnText}>Bloquer l'heure</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  content: {
    backgroundColor: colors.ink,
    borderRadius: radius.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  title: {
    fontFamily: 'Syne_700Bold',
    fontSize: 20,
    color: colors.textPrimary,
  },
  closeBtn: {
    padding: spacing.sm,
  },
  body: {
    padding: spacing.xl,
  },
  label: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.carbon,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 52,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: spacing.xl,
  },
  input: {
    flex: 1,
    marginLeft: spacing.sm,
    color: colors.textPrimary,
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.amber,
    borderRadius: radius.md,
    padding: spacing.md,
    height: 52,
    gap: spacing.sm,
  },
  submitBtnText: {
    fontFamily: 'Syne_700Bold',
    fontSize: 16,
    color: colors.ink,
  },
});
