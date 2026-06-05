import Toast from 'react-native-toast-message';
// apps/mobile/src/components/barber/AddStaffModal.tsx
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
import { colors, radius, spacing } from '../../theme';
import Ionicons from "@react-native-vector-icons/ionicons";
import { apiClient } from '../../lib/apiClient';

interface AddStaffModalProps {
  visible: boolean;
  onClose: () => void;
  salonId: string;
  onSuccess: () => void;
}

export function AddStaffModal({ visible, onClose, salonId, onSuccess }: AddStaffModalProps) {
  const [loading, setLoading] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Veuillez entrer le nom et le prénom du barbier'
      });
      return;
    }

    setLoading(true);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`;

      await apiClient.post(`/salons/${salonId}/staff`, {
        customName: fullName,
      });

      Toast.show({
        type: 'success',
        text1: 'Succès',
        text2: `${fullName} a été ajouté à votre équipe !`
      });
      onSuccess();
      setFirstName('');
      setLastName('');
      onClose();
    } catch (err: unknown) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: (err as Error).message || 'Impossible d\'ajouter ce barbier'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Ajouter un Barbier</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.description}>
            Entrez le nom et prénom du barbier pour l'ajouter à votre salon.
          </Text>

          <Text style={styles.label}>Prénom</Text>
          <View style={styles.inputRow}>
            <Ionicons name="person-outline" size={18} color={colors.amber} />
            <TextInput
              style={styles.input}
              placeholder="Ex: Ahmed"
              placeholderTextColor={colors.textMuted}
              value={firstName}
              onChangeText={setFirstName}
              maxLength={30}
            />
          </View>

          <View style={{ height: spacing.md }} />

          <Text style={styles.label}>Nom de famille</Text>
          <View style={styles.inputRow}>
            <Ionicons name="person-outline" size={18} color={colors.amber} />
            <TextInput
              style={styles.input}
              placeholder="Ex: Yasser"
              placeholderTextColor={colors.textMuted}
              value={lastName}
              onChangeText={setLastName}
              maxLength={30}
            />
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
              {loading ? (
                <ActivityIndicator color={colors.ink} />
              ) : (
                <>
                  <Ionicons name="person-add" size={18} color={colors.ink} />
                  <Text style={styles.submitBtnText}>Ajouter</Text>
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
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: colors.ink,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: 'Syne_700Bold',
    fontSize: 20,
    color: colors.textPrimary,
  },
  description: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  label: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.carbon,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 52,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
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
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  submitBtnText: {
    color: colors.ink,
    fontFamily: 'Syne_700Bold',
  },
});
