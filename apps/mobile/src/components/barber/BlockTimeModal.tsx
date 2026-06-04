import React, { useState, useMemo } from 'react';
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
import { colors, radius, spacing } from '../../theme';
import Ionicons from '@react-native-vector-icons/ionicons';
import { apiClient } from '../../lib/apiClient';
import { useQueryClient } from '@tanstack/react-query';

interface BlockTimeModalProps {
  visible: boolean;
  onClose: () => void;
  salonId: string;
  onSuccess: () => void;
}

// Convert "H:MM" or "HH:MM" to minutes since midnight
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

// Format a date string to "Jeu 05 Juin"
function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });
}

// Get next N days starting from today
function getNextDays(n = 14): string[] {
  const days: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

// Quick time presets
const TIME_PRESETS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];

export function BlockTimeModal({ visible, onClose, salonId, onSuccess }: BlockTimeModalProps) {
  const queryClient = useQueryClient();
  const days = useMemo(() => getNextDays(14), []);
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [startTime, setStartTime] = useState('15:00');
  const [endTime, setEndTime] = useState('16:00');
  const [loading, setLoading] = useState(false);

  const handleBlock = async () => {
    if (!startTime || !endTime) {
      Alert.alert('Erreur', 'Veuillez saisir une heure de début et de fin');
      return;
    }
    if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(startTime) ||
        !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(endTime)) {
      Alert.alert('Erreur', 'Format invalide. Utilisez HH:MM (ex: 15:00)');
      return;
    }
    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      Alert.alert('Erreur', "L'heure de fin doit être après l'heure de début.");
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/reservations/block', {
        salonId,
        date: selectedDate,
        startTime,
        endTime,
      });

      // Invalidate slot cache so the blocked window appears immediately
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['barber-reservations'] }),
        queryClient.invalidateQueries({ queryKey: ['slots'] }),
      ]);

      onSuccess();
      setStartTime('15:00');
      setEndTime('16:00');
      setSelectedDate(todayStr);
      onClose();
    } catch (err: unknown) {
      Alert.alert('Erreur', (err as Error).message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.handle} />
            <Text style={styles.title}>🔒 Bloquer un créneau</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            {/* Date selection strip */}
            <Text style={styles.sectionLabel}>Date</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dateStrip}
            >
              {days.map((day) => {
                const isSelected = day === selectedDate;
                const label = formatDateLabel(day);
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayChip, isSelected && styles.dayChipSelected]}
                    onPress={() => setSelectedDate(day)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.dayChipText, isSelected && styles.dayChipTextSelected]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Start time */}
            <Text style={styles.sectionLabel}>Heure de début</Text>
            <View style={styles.inputRow}>
              <View style={styles.inputContainer}>
                <Ionicons name="time-outline" size={18} color={colors.amber} />
                <TextInput
                  style={styles.input}
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="15:00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>
            {/* Quick presets for start */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presets}>
              {TIME_PRESETS.map((t) => (
                <TouchableOpacity
                  key={`s-${t}`}
                  style={[styles.preset, startTime === t && styles.presetSelected]}
                  onPress={() => setStartTime(t)}
                >
                  <Text style={[styles.presetText, startTime === t && styles.presetTextSelected]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* End time */}
            <Text style={styles.sectionLabel}>Heure de fin</Text>
            <View style={styles.inputRow}>
              <View style={styles.inputContainer}>
                <Ionicons name="time-outline" size={18} color={colors.amber} />
                <TextInput
                  style={styles.input}
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="16:00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>
            {/* Quick presets for end */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presets}>
              {TIME_PRESETS.map((t) => (
                <TouchableOpacity
                  key={`e-${t}`}
                  style={[styles.preset, endTime === t && styles.presetSelected]}
                  onPress={() => setEndTime(t)}
                >
                  <Text style={[styles.presetText, endTime === t && styles.presetTextSelected]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Summary */}
            <View style={styles.summary}>
              <Ionicons name="lock-closed" size={16} color={colors.amber} />
              <Text style={styles.summaryText}>
                Bloquer {formatDateLabel(selectedDate)} de {startTime} à {endTime}
              </Text>
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleBlock}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={colors.ink} />
              ) : (
                <>
                  <Ionicons name="lock-closed" size={18} color={colors.ink} />
                  <Text style={styles.submitBtnText}>Bloquer ce créneau</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.ink,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  header: {
    padding: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  title: {
    fontFamily: 'Syne_700Bold',
    fontSize: 20,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  closeBtn: {
    position: 'absolute',
    right: spacing.xl,
    top: spacing.xl,
    padding: spacing.sm,
  },
  body: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  sectionLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  dateStrip: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  dayChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.carbon,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  dayChipSelected: {
    backgroundColor: colors.amber,
    borderColor: colors.amber,
  },
  dayChipText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: colors.textSecondary,
  },
  dayChipTextSelected: {
    color: colors.ink,
    fontFamily: 'DMSans_700Bold',
  },
  inputRow: {
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
  },
  input: {
    flex: 1,
    marginLeft: spacing.sm,
    color: colors.textPrimary,
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
  },
  presets: {
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
  preset: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.carbon,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  presetSelected: {
    backgroundColor: 'rgba(232,160,32,0.15)',
    borderColor: colors.amber,
  },
  presetText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    color: colors.textMuted,
  },
  presetTextSelected: {
    color: colors.amber,
    fontFamily: 'DMSans_700Bold',
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(232,160,32,0.08)',
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(232,160,32,0.15)',
  },
  summaryText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: colors.amber,
    flex: 1,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.amber,
    borderRadius: radius.md,
    padding: spacing.md,
    height: 56,
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontFamily: 'Syne_700Bold',
    fontSize: 16,
    color: colors.ink,
  },
});
