// apps/mobile/src/components/barber/EditSalonModal.tsx
// Modal for editing salon settings: name, description, wilaya, address, hours

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing, radius } from '../../theme';
import Ionicons from '@react-native-vector-icons/ionicons';
import { apiClient } from '../../lib/apiClient';

interface EditSalonModalProps {
  visible: boolean;
  onClose: () => void;
  salon: Record<string, unknown>;
  onSaved: () => void;
}

// All 58 Algerian wilayas
const WILAYAS = [
  'Adrar', 'Chlef', 'Laghouat', 'Oum El Bouaghi', 'Batna', 'Béjaïa', 'Biskra',
  'Béchar', 'Blida', 'Bouira', 'Tamanrasset', 'Tébessa', 'Tlemcen', 'Tiaret',
  'Tizi Ouzou', 'Alger', 'Djelfa', 'Jijel', 'Sétif', 'Saïda', 'Skikda',
  'Sidi Bel Abbès', 'Annaba', 'Guelma', 'Constantine', 'Médéa', 'Mostaganem',
  'M\'Sila', 'Mascara', 'Ouargla', 'Oran', 'El Bayadh', 'Illizi', 'Bordj Bou Arréridj',
  'Boumerdès', 'El Tarf', 'Tindouf', 'Tissemsilt', 'El Oued', 'Khenchela',
  'Souk Ahras', 'Tipaza', 'Mila', 'Aïn Defla', 'Naâma', 'Aïn Témouchent',
  'Ghardaïa', 'Relizane', 'Timimoun', 'Bordj Badji Mokhtar', 'Ouled Djellal',
  'Béni Abbès', 'In Salah', 'In Guezzam', 'Touggourt', 'Djanet', 'El M\'Ghair', 'El Meniaa',
];

export function EditSalonModal({ visible, onClose, salon, onSaved }: EditSalonModalProps) {
  const user = useAuthStore((s) => s.user);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [wilaya, setWilaya] = useState('');
  const [address, setAddress] = useState('');
  const [openTime, setOpenTime] = useState('');
  const [closeTime, setCloseTime] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (salon && visible) {
      setName(salon.name || '');
      setDescription(salon.description || '');
      setWilaya(salon.wilaya || '');
      setAddress(salon.address || '');
      setOpenTime(salon.open_time?.substring(0, 5) || '09:00');
      setCloseTime(salon.close_time?.substring(0, 5) || '20:00');
      setImageUrl(salon.image_url || null);
    }
  }, [salon, visible]);

  const handleSave = async () => {
    if (!salon) return;
    if (!name.trim()) {
      Alert.alert('Erreur', 'Le nom du salon est obligatoire');
      return;
    }
    if (!wilaya.trim()) {
      Alert.alert('Erreur', 'La wilaya est obligatoire');
      return;
    }

    setSaving(true);
    try {
      await apiClient.patch(`/salons/${salon.id}`, {
        name: name.trim(),
        description: description.trim() || null,
        wilaya: wilaya.trim(),
        address: address.trim(),
        open_time: openTime,
        close_time: closeTime,
        image_url: imageUrl,
      });

      Alert.alert('Succès', 'Salon mis à jour');
      onSaved();
      onClose();
    } catch (err: unknown) {
      Alert.alert('Erreur', (err as Error).message || 'Une erreur est survenue');
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9], // Salon covers are usually wide
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0 && result.assets[0].base64) {
        await uploadImage(result.assets[0].base64);
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de sélectionner la photo');
    }
  };

  const uploadImage = async (base64String: string) => {
    if (!salon || !user) return;
    setUploadingImage(true);
    try {
      const filePath = `${user.id}/salons/${salon.id}_cover_${Date.now()}.jpg`;

      const { data, error } = await supabase.storage
        .from('salons') // Salon covers go into the 'salons' bucket
        .upload(filePath, decode(base64String), {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from('salons')
        .getPublicUrl(data.path);

      setImageUrl(publicUrlData.publicUrl);
    } catch (err: unknown) {
      Alert.alert('Erreur', "L'upload de l'image a échoué.");
    } finally {
      setUploadingImage(false);
    }
  };

  const selectWilaya = () => {
    Alert.alert(
      'Choisir la wilaya',
      '',
      WILAYAS.map((w) => ({
        text: w,
        onPress: () => setWilaya(w),
      })),
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Paramètres du salon</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.7}>
              {saving ? (
                <ActivityIndicator color={colors.amber} size="small" />
              ) : (
                <Text style={styles.saveText}>Enregistrer</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            
            {/* Image Upload Area */}
            <TouchableOpacity style={styles.imageUploadContainer} onPress={pickImage} activeOpacity={0.8}>
              {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={styles.coverPreview} />
              ) : (
                <View style={styles.imageUploadPlaceholder}>
                  <Ionicons name="camera" size={32} color={colors.textMuted} />
                  <Text style={styles.imageUploadText}>Ajouter une photo du salon</Text>
                </View>
              )}
              {uploadingImage && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator color={colors.amber} size="large" />
                </View>
              )}
              {imageUrl && !uploadingImage && (
                <View style={styles.editImageBadge}>
                  <Ionicons name="pencil" size={16} color={colors.ink} />
                </View>
              )}
            </TouchableOpacity>

            {/* Name */}
            <Text style={styles.label}>Nom du salon</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="business-outline" size={18} color={colors.amber} />
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Nom du salon"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Description */}
            <Text style={styles.label}>Description</Text>
            <View style={[styles.inputContainer, { height: 90, alignItems: 'flex-start', paddingVertical: spacing.sm }]}>
              <Ionicons name="document-text-outline" size={18} color={colors.amber} style={{ marginTop: 4 }} />
              <TextInput
                style={[styles.input, { textAlignVertical: 'top' }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Décrivez votre salon..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Wilaya */}
            <Text style={styles.label}>Wilaya</Text>
            <TouchableOpacity style={styles.inputContainer} onPress={selectWilaya} activeOpacity={0.7}>
              <Ionicons name="location-outline" size={18} color={colors.amber} />
              <Text style={[styles.input, { color: wilaya ? colors.textPrimary : colors.textMuted }]}>
                {wilaya || 'Sélectionner la wilaya'}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Address */}
            <Text style={styles.label}>Adresse</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="map-outline" size={18} color={colors.amber} />
              <TextInput
                style={styles.input}
                value={address}
                onChangeText={setAddress}
                placeholder="Adresse complète"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Hours */}
            <Text style={styles.label}>Horaires d'ouverture</Text>
            <View style={styles.hoursRow}>
              <View style={[styles.inputContainer, { flex: 1 }]}>
                <Ionicons name="time-outline" size={18} color={colors.success} />
                <TextInput
                  style={styles.input}
                  value={openTime}
                  onChangeText={setOpenTime}
                  placeholder="09:00"
                  placeholderTextColor={colors.textMuted}
                  maxLength={5}
                />
              </View>
              <Text style={styles.hoursSeparator}>→</Text>
              <View style={[styles.inputContainer, { flex: 1 }]}>
                <Ionicons name="time-outline" size={18} color={colors.error} />
                <TextInput
                  style={styles.input}
                  value={closeTime}
                  onChangeText={setCloseTime}
                  placeholder="20:00"
                  placeholderTextColor={colors.textMuted}
                  maxLength={5}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.ink,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 17,
    color: colors.textPrimary,
  },
  saveText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    color: colors.amber,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 40,
  },
  label: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    height: 52,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  hoursSeparator: {
    fontFamily: 'Syne_700Bold',
    fontSize: 18,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  imageUploadContainer: {
    height: 160,
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageUploadPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  imageUploadText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: colors.textMuted,
  },
  uploadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editImageBadge: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.amber,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
