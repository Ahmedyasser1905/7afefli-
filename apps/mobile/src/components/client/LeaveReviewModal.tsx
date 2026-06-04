// apps/mobile/src/components/client/LeaveReviewModal.tsx
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
import { useAuthStore } from '../../store/authStore';
import { colors, radius, spacing } from '../../theme';
import Ionicons from "@react-native-vector-icons/ionicons";
import { apiClient } from '../../lib/apiClient';

interface LeaveReviewModalProps {
  visible: boolean;
  onClose: () => void;
  reservation: Record<string, unknown>;
  onSuccess: () => void;
}

export function LeaveReviewModal({ visible, onClose, reservation, onSuccess }: LeaveReviewModalProps) {
  const user = useAuthStore((s) => s.user);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!reservation) return;

    // Guard against missing salon join — reservation must have salon data to submit
    const salon = reservation.salons as Record<string, unknown> | null | undefined;
    if (!salon?.id) {
      Alert.alert('Erreur', 'Impossible de soumettre l\'avis: données du salon manquantes.');
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/reviews', {
        reservationId: reservation.id,
        salonId: salon.id,
        rating,
        comment: comment.trim() || null,
      });

      Alert.alert('Merci !', 'Votre avis a été enregistré.');
      onSuccess();
      // Reset state for next use
      setRating(5);
      setComment('');
      onClose();
    } catch (err: unknown) {
      const errMsg = (err as Error).message || '';
      if (errMsg.includes('23505')) {
        // Duplicate review — not an error for the user
        Alert.alert('Info', 'Vous avez déjà laissé un avis pour ce rendez-vous.');
        onSuccess();
        onClose();
      } else {
        Alert.alert('Erreur', 'Impossible d\'enregistrer votre avis. Veuillez réessayer.');
      }
    } finally {
      setLoading(false);
    }
  };

  const salon = reservation?.salons as Record<string, unknown> | null | undefined;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.title}>Laisser un avis</Text>
          <Text style={styles.subtitle}>
            Comment s'est passé votre rendez-vous{salon?.name ? ` chez ${salon.name}` : ''} ?
          </Text>
          
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setRating(star)}>
                <Ionicons
                  name={star <= rating ? "star" : "star-outline"}
                  size={40}
                  color={colors.amber}
                  style={{ marginHorizontal: 4 }}
                />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Commentaire (Optionnel)</Text>
          <TextInput
            style={styles.input}
            placeholder="Écrivez votre avis ici..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
            value={comment}
            onChangeText={setComment}
          />

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.submitBtnText}>Envoyer</Text>}
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
    fontSize: 22,
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    marginBottom: spacing.xl,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  label: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.carbon,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    fontFamily: 'DMSans_400Regular',
    height: 100,
    textAlignVertical: 'top',
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
