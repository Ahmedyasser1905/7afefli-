import Toast from 'react-native-toast-message';
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
  FlatList,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

import DateTimePicker from '@react-native-community/datetimepicker';
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

// Time chips from 06:00 to 00:00 in 30-minute increments
const TIME_CHIPS: string[] = [];
for (let h = 6; h <= 23; h++) {
  TIME_CHIPS.push(`${String(h).padStart(2, '0')}:00`);
  TIME_CHIPS.push(`${String(h).padStart(2, '0')}:30`);
}
TIME_CHIPS.push('00:00');

export function EditSalonModal({ visible, onClose, salon, onSaved }: EditSalonModalProps) {
  const user = useAuthStore((s) => s.user);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [wilaya, setWilaya] = useState('');
  const [commune, setCommune] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [openTime, setOpenTime] = useState('');
  const [closeTime, setCloseTime] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [workingDays, setWorkingDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [isWilayaModalVisible, setIsWilayaModalVisible] = useState(false);
  const [wilayaSearch, setWilayaSearch] = useState('');
  const [wilayas, setWilayas] = useState<string[]>([]);
  const [showOpenPicker, setShowOpenPicker] = useState(false);
  const [showClosePicker, setShowClosePicker] = useState(false);

  useEffect(() => {
    apiClient.get<string[]>('/locations/wilayas').then((data) => setWilayas(data)).catch(() => {});
  }, []);

  const filteredWilayas = wilayas.filter((w) => w.toLowerCase().includes(wilayaSearch.toLowerCase()));

  useEffect(() => {
    if (salon && visible) {
      const s = salon as any;
      setName(s.name || '');
      setDescription(s.description || '');
      setWilaya(s.wilaya || '');
      setCommune(s.commune || '');
      setAddress(s.address || '');
      setPhone(s.phone || '');
      setOpenTime(s.open_time?.substring(0, 5) || '09:00');
      setCloseTime(s.close_time?.substring(0, 5) || '20:00');
      setImageUrl(s.image_url || null);
      setWorkingDays(s.working_days || [0, 1, 2, 3, 4, 5, 6]);
    }
  }, [salon, visible]);

  const handleSave = async () => {
    if (!salon) return;
    if (!name.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Le nom du salon est obligatoire'
      });
      return;
    }
    if (!wilaya.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'La wilaya est obligatoire'
      });
      return;
    }

    setSaving(true);
    try {
      await apiClient.patch(`/salons/${salon.id}`, {
        name: name.trim(),
        description: description.trim() || null,
        wilaya: wilaya.trim(),
        commune: commune.trim(),
        address: address.trim(),
        phone: phone.trim(),
        open_time: openTime,
        close_time: closeTime,
        image_url: imageUrl,
        working_days: workingDays,
      });

      Toast.show({
        type: 'success',
        text1: 'Succès',
        text2: 'Salon mis à jour'
      });
      onSaved();
      onClose();
    } catch (err: unknown) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: (err as Error).message || 'Une erreur est survenue'
      });
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0 && result.assets[0].uri) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Impossible de sélectionner la photo',
      });
    }
  };

  const uploadImage = async (uri: string) => {
    if (!salon || !user) return;
    setUploadingImage(true);
    try {
      // M2: Compress to 1600px wide, JPEG 75% before uploading salon covers
      const compressed = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1600 } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
      );

      // Step 1: Get a signed upload URL from the backend (uses service role → bypasses RLS)
      const { signedUrl, storagePath } = await apiClient.post<{
        signedUrl: string;
        storagePath: string;
        token: string;
      }>(`/salons/${(salon as any).id}/cover/upload-url`, {});

      // Step 2: Upload via FormData — React Native reads the file URI natively on the
      // native bridge, avoiding the Hermes ArrayBuffer / Blob serialization bugs that
      // break raw blob PUT requests in production builds. This matches the approach
      // used internally by the Supabase JS SDK's uploadToSignedUrl().
      const formData = new FormData();
      formData.append('', { uri: compressed.uri, type: 'image/jpeg', name: 'cover.jpg' } as any);

      const uploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errText = await uploadResponse.text().catch(() => '');
        throw new Error(`Upload failed (${uploadResponse.status}): ${errText}`);
      }

      // Step 3: Get the public URL
      const { data: publicUrlData } = supabase.storage
        .from('salon-covers')
        .getPublicUrl(storagePath);

      // H3: Immediately persist image_url to the database so it is not lost
      // if the user closes the modal without tapping "Enregistrer".
      await apiClient.patch(`/salons/${(salon as any).id}`, {
        image_url: publicUrlData.publicUrl,
      });

      setImageUrl(publicUrlData.publicUrl);

      // Notify the parent so the salon query is refreshed immediately
      onSaved();
    } catch (err: unknown) {
      const msg = (err as Error).message || "L'upload de l'image a échoué.";
      Toast.show({
        type: 'error',
        text1: 'Erreur upload',
        text2: msg.length > 80 ? msg.substring(0, 80) + '…' : msg,
      });
    } finally {
      setUploadingImage(false);
    }
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
            <TouchableOpacity style={styles.inputContainer} onPress={() => setIsWilayaModalVisible(true)} activeOpacity={0.7}>
              <Ionicons name="location-outline" size={18} color={colors.amber} />
              <Text style={[styles.input, { color: wilaya ? colors.textPrimary : colors.textMuted }]}>
                {wilaya || 'Sélectionner la wilaya'}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Commune */}
            <Text style={styles.label}>Commune</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="location-outline" size={18} color={colors.amber} />
              <TextInput
                style={styles.input}
                value={commune}
                onChangeText={setCommune}
                placeholder="Commune"
                placeholderTextColor={colors.textMuted}
              />
            </View>

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

            {/* Phone */}
            <Text style={styles.label}>Téléphone du salon</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="call-outline" size={18} color={colors.amber} />
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="Téléphone du salon"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
              />
            </View>

            {/* Hours — Scrollable chip selectors */}
            <Text style={styles.label}>Heure d'ouverture</Text>
            <TouchableOpacity style={styles.inputContainer} onPress={() => setShowOpenPicker(true)}>
              <Ionicons name="time-outline" size={18} color={colors.amber} />
              <Text style={styles.input}>{openTime}</Text>
            </TouchableOpacity>
            {showOpenPicker && (
              <DateTimePicker
                value={new Date(`2000-01-01T${openTime}:00`)}
                mode="time"
                is24Hour={true}
                display="default"
                onChange={(event, date) => {
                  setShowOpenPicker(false);
                  if (date) {
                    setOpenTime(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`);
                  }
                }}
              />
            )}

            <Text style={styles.label}>Heure de fermeture</Text>
            <TouchableOpacity style={styles.inputContainer} onPress={() => setShowClosePicker(true)}>
              <Ionicons name="time-outline" size={18} color={colors.amber} />
              <Text style={styles.input}>{closeTime}</Text>
            </TouchableOpacity>
            {showClosePicker && (
              <DateTimePicker
                value={new Date(`2000-01-01T${closeTime}:00`)}
                mode="time"
                is24Hour={true}
                display="default"
                onChange={(event, date) => {
                  setShowClosePicker(false);
                  if (date) {
                    setCloseTime(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`);
                  }
                }}
              />
            )}

            {/* Working Days */}
            <Text style={styles.label}>Jours de travail</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }}>
              {Array.from({ length: 7 }, (_, i) => { const d = new Date(2023, 0, 1 + i); return { day: d.getDay(), label: new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(d).charAt(0).toUpperCase() + new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(d).slice(1) }; }).sort((a, b) => a.day - b.day).map(({ day, label }) => {
                const isActive = workingDays.includes(day);
                return (
                  <TouchableOpacity
                    key={day}
                    onPress={() => setWorkingDays(prev => isActive ? prev.filter(d => d !== day) : [...prev, day].sort())}
                    style={{
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      borderRadius: radius.md,
                      backgroundColor: isActive ? colors.amber : colors.carbon,
                      borderWidth: 1,
                      borderColor: isActive ? colors.amber : 'rgba(255,255,255,0.1)',
                    }}
                  >
                    <Text style={{
                      fontFamily: 'DMSans_700Bold',
                      fontSize: 13,
                      color: isActive ? colors.ink : colors.textSecondary,
                    }}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Wilaya Selection Modal */}
          <Modal visible={isWilayaModalVisible} animationType="slide" transparent onRequestClose={() => setIsWilayaModalVisible(false)}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
              <View style={{ backgroundColor: colors.ink, borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '70%' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
                  <TouchableOpacity onPress={() => setIsWilayaModalVisible(false)} activeOpacity={0.7}>
                    <Ionicons name="close" size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                  <Text style={{ fontFamily: 'Syne_700Bold', fontSize: 18, color: colors.textPrimary }}>Choisir la Wilaya</Text>
                  <View style={{ width: 24 }} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.carbon, margin: spacing.lg, paddingHorizontal: spacing.md, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                  <Ionicons name="search" size={18} color={colors.textSecondary} />
                  <TextInput
                    style={{ flex: 1, color: colors.textPrimary, fontFamily: 'DMSans_400Regular', marginLeft: spacing.sm }}
                    placeholder="Rechercher une wilaya..."
                    placeholderTextColor={colors.textMuted}
                    value={wilayaSearch}
                    onChangeText={setWilayaSearch}
                  />
                </View>
                <FlatList
                  data={filteredWilayas}
                  keyExtractor={(item) => item}
                  renderItem={({ item }) => (
                    <TouchableOpacity 
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.02)' }}
                      onPress={() => { setWilaya(item); setIsWilayaModalVisible(false); setWilayaSearch(''); }}
                    >
                      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: wilaya === item ? colors.amber : colors.textPrimary }}>{item}</Text>
                      {wilaya === item && <Ionicons name="checkmark" size={18} color={colors.amber} />}
                    </TouchableOpacity>
                  )}
                  contentContainerStyle={{ paddingBottom: 40 }}
                  showsVerticalScrollIndicator={false}
                />
              </View>
            </View>
          </Modal>
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
