// apps/mobile/src/components/barber/ServiceModal.tsx
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
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { colors, radius, spacing } from '../../theme';
import Ionicons from "@react-native-vector-icons/ionicons";
import { apiClient } from '../../lib/apiClient';

interface ServiceModalProps {
  visible: boolean;
  onClose: () => void;
  salonId: string;
  onSuccess: () => void;
}

export function ServiceModal({ visible, onClose, salonId, onSuccess }: ServiceModalProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    service_name: '',
    price: '',
    duration_minutes: '30',
  });

  const handleSubmit = async () => {
    if (!form.service_name || !form.price || !form.duration_minutes) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    setLoading(true);
    try {
      await apiClient.post(`/salons/${salonId}/services`, {
        service_name: form.service_name,
        price: parseInt(form.price),
        duration_minutes: parseInt(form.duration_minutes),
      });
      
      onSuccess();
      setForm({ service_name: '', price: '', duration_minutes: '30' });
      onClose();
    } catch (err: unknown) {
      Alert.alert('Erreur', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.title}>Ajouter un Service</Text>
          
          <Text style={styles.label}>Nom du service</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Coupe classique"
            placeholderTextColor={colors.textMuted}
            value={form.service_name}
            onChangeText={(t) => setForm({ ...form, service_name: t })}
          />

          <Text style={styles.label}>Prix (DZD)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: 500"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
            value={form.price}
            onChangeText={(t) => setForm({ ...form, price: t })}
          />

          <Text style={styles.label}>Durée (minutes)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: 30"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
            value={form.duration_minutes}
            onChangeText={(t) => setForm({ ...form, duration_minutes: t })}
          />

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.submitBtnText}>Ajouter</Text>}
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
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: colors.ink,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
  },
  title: {
    fontFamily: 'Syne_700Bold',
    fontSize: 20,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
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
  },
  buttons: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  cancelBtn: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.amber,
  },
  cancelBtnText: {
    color: colors.amber,
    fontFamily: 'Syne_700Bold',
  },
  submitBtn: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.amber,
  },
  submitBtnText: {
    color: colors.ink,
    fontFamily: 'Syne_700Bold',
  },
});
