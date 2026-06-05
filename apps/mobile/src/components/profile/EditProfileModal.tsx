// apps/mobile/src/components/profile/EditProfileModal.tsx
// Modal for editing user profile: name, phone, avatar photo

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing, radius } from '../../theme';
import Ionicons from '@react-native-vector-icons/ionicons';
import { decode } from 'base64-arraybuffer';
import { apiClient } from '../../lib/apiClient';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  profileData: Record<string, unknown>;
  onSaved: () => void;
}

export function EditProfileModal({ visible, onClose, profileData, onSaved }: EditProfileModalProps) {
  const user = useAuthStore((s) => s.user);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (profileData) {
      setFullName(profileData.full_name || '');
      setPhone(profileData.phone_number || '');
      setAvatarUrl(profileData.avatar_url || null);
    }
  }, [profileData, visible]);

  const pickAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setUploading(true);
        const fileName = `${user?.id}/${Date.now()}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, decode(result.assets[0].base64), {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);

        setAvatarUrl(publicUrlData.publicUrl);
        setUploading(false);
      }
    } catch (err: unknown) {
      setUploading(false);
      Alert.alert('Erreur', (err as Error).message || 'Impossible de télécharger la photo');
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!fullName.trim()) {
      Alert.alert('Erreur', 'Le nom est obligatoire');
      return;
    }

    setSaving(true);
    try {
      const updates: unknown = {
        full_name: fullName.trim(),
        phone_number: phone.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (avatarUrl) {
        updates.avatar_url = avatarUrl;
      }

      await apiClient.patch('/auth/profiles/me', updates);

      Alert.alert('Succès', 'Profil mis à jour');
      onSaved();
      onClose();
    } catch (err: unknown) {
      Alert.alert('Erreur', (err as Error).message || 'Une erreur est survenue');
    } finally {
      setSaving(false);
    }
  };

  const displayAvatar = avatarUrl || profileData?.avatar_url;

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
            <Text style={styles.headerTitle}>Modifier le profil</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.7}>
              {saving ? (
                <ActivityIndicator color={colors.amber} size="small" />
              ) : (
                <Text style={styles.saveText}>Enregistrer</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Avatar */}
            <TouchableOpacity style={styles.avatarContainer} onPress={pickAvatar} activeOpacity={0.8}>
              {uploading ? (
                <View style={styles.avatarPlaceholder}>
                  <ActivityIndicator color={colors.amber} />
                </View>
              ) : displayAvatar ? (
                <Image source={{ uri: displayAvatar }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={40} color={colors.amber} />
                </View>
              )}
              <View style={styles.cameraIcon}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarHint}>Appuyez pour changer la photo</Text>

            {/* Name Input */}
            <Text style={styles.label}>Nom complet</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={18} color={colors.amber} />
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Votre nom"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Phone Input */}
            <Text style={styles.label}>Numéro de téléphone</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="call-outline" size={18} color={colors.amber} />
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="0X XX XX XX XX"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                maxLength={15}
              />
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
    maxHeight: '85%',
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
  avatarContainer: {
    alignSelf: 'center',
    position: 'relative',
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: colors.amber,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(232,160,32,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(232,160,32,0.3)',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.ink,
  },
  avatarHint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
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
});
