import Toast from 'react-native-toast-message';
// apps/mobile/src/components/barber/ServiceModal.tsx
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
} from 'react-native';
import { colors, radius, spacing } from '../../theme';
import Ionicons from "@react-native-vector-icons/ionicons";
import { apiClient } from '../../lib/apiClient';

interface ServiceModalProps {
  visible: boolean;
  onClose: () => void;
  salonId: string;
  onSuccess: () => void;
  service?: { id: string; service_name: string; description?: string; price: number; duration_minutes: number } | null;
}

export function ServiceModal({ visible, onClose, salonId, onSuccess, service }: ServiceModalProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    service_name: '',
    description: '',
    price: '',
    duration_minutes: '',
  });

  const isEditing = !!service;

  useEffect(() => {
    if (service) {
      setForm({
        service_name: service.service_name,
        description: service.description || '',
        price: String(service.price),
        duration_minutes: String(service.duration_minutes),
      });
    }
  }, [service]);

  const resetAndClose = () => {
    setForm({ service_name: '', description: '', price: '', duration_minutes: '' });
    onClose();
  };

  const handleSubmit = async () => {
    if (!form.service_name || !form.price || !form.duration_minutes) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Veuillez remplir tous les champs'
      });
      return;
    }

    const price = parseInt(form.price, 10);
    const duration = parseInt(form.duration_minutes, 10);

    if (isNaN(price) || price <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Le prix doit être un nombre positif'
      });
      return;
    }
    if (isNaN(duration) || duration <= 0 || duration > 480) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'La durée doit être entre 1 et 480 minutes'
      });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        service_name: form.service_name,
        description: form.description.trim() || null,
        price,
        duration_minutes: duration,
      };

      if (isEditing && service) {
        await apiClient.patch(`/salons/${salonId}/services/${service.id}`, payload);
      } else {
        await apiClient.post(`/salons/${salonId}/services`, payload);
      }
      
      onSuccess();
      setForm({ service_name: '', description: '', price: '', duration_minutes: '' });
      onClose();
    } catch (err: unknown) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: (err as Error).message || 'Une erreur est survenue'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.title}>{isEditing ? 'Modifier le service' : 'Ajouter un Service'}</Text>
          
          <Text style={styles.label}>Nom du service</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Coupe classique"
            placeholderTextColor={colors.textMuted}
            value={form.service_name}
            onChangeText={(t) => setForm({ ...form, service_name: t })}
          />

          <Text style={styles.label}>Description (optionnel)</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            placeholder="Décrivez ce service..."
            placeholderTextColor={colors.textMuted}
            value={form.description}
            onChangeText={(t) => setForm({ ...form, description: t })}
            multiline
            numberOfLines={3}
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
            <TouchableOpacity style={styles.cancelBtn} onPress={resetAndClose}>
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.submitBtnText}>{isEditing ? 'Enregistrer' : 'Ajouter'}</Text>}
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
