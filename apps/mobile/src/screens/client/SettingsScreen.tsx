// apps/mobile/src/screens/client/SettingsScreen.tsx
// Premium Settings & Profile management screen

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
  Image,
  Modal,
  FlatList,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { apiClient } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing, radius, shadows } from '../../theme';
import Ionicons from "@react-native-vector-icons/ionicons";
import { EditProfileModal } from '../../components/profile/EditProfileModal';
import * as SecureStore from 'expo-secure-store';

const DEFAULT_AVATAR = 'https://lh3.googleusercontent.com/aida-public/AB6AXuDhsTHtiP3Z4tCtsj3LGHwYS5xdJSlpMbLr-LvZld6LDrXErLk7k8pnjAS32G_HSNI0P2IuYAfQwpOp6Wr_9ufZKN6Klf7rxMQhmAnJmKwnPZIuuttQO7lWVDMWVmvbYLskVk5Ocfp_zGhXguCLwBCGAf8i0IbCjWKcjYkjEhCD3lEeJlMSlIAkiPwLvg1yvPehfA1FUh8sJwyUIeVjhtiKmRuyLFwa9Jo3HVhFr1t6_hj4T5WdrFjZki5vffu7I-q1rZHS5Owb9XUe';

export function SettingsScreen() {
  const { user, role, clearAuth } = useAuthStore();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(true);
  const [selectedWilaya, setSelectedWilaya] = useState('Alger');
  const [profileData, setProfileData] = useState<Record<string, unknown>>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditProfileVisible, setIsEditProfileVisible] = useState(false);
  const [isWilayaModalVisible, setIsWilayaModalVisible] = useState(false);
  const [wilayaSearch, setWilayaSearch] = useState('');

  const ALL_WILAYAS = [
    '01 - Adrar', '02 - Chlef', '03 - Laghouat', '04 - Oum El Bouaghi', '05 - Batna',
    '06 - Béjaïa', '07 - Biskra', '08 - Béchar', '09 - Blida', '10 - Bouira',
    '11 - Tamanrasset', '12 - Tébessa', '13 - Tlemcen', '14 - Tiaret', '15 - Tizi Ouzou',
    '16 - Alger', '17 - Djelfa', '18 - Jijel', '19 - Sétif', '20 - Saïda',
    '21 - Skikda', '22 - Sidi Bel Abbès', '23 - Annaba', '24 - Guelma', '25 - Constantine',
    '26 - Médéa', '27 - Mostaganem', '28 - M\'Sila', '29 - Mascara', '30 - Ouargla',
    '31 - Oran', '32 - El Bayadh', '33 - Illizi', '34 - Bordj Bou Arreridj', '35 - Boumerdès',
    '36 - El Tarf', '37 - Tindouf', '38 - Tissemsilt', '39 - El Oued', '40 - Khenchela',
    '41 - Souk Ahras', '42 - Tipaza', '43 - Mila', '44 - Aïn Defla', '45 - Naâma',
    '46 - Aïn Témouchent', '47 - Ghardaïa', '48 - Relizane', '49 - El M\'Ghair', '50 - El Meniaa',
    '51 - Ouled Djellal', '52 - Bordj Badji Mokhtar', '53 - Béni Abbès', '54 - Timimoun',
    '55 - Touggourt', '56 - Djanet', '57 - In Salah', '58 - In Guezzam',
  ];

  const filteredWilayas = ALL_WILAYAS.filter((w) =>
    w.toLowerCase().includes(wilayaSearch.toLowerCase())
  );

  // Load profile directly from Supabase (faster, no backend round-trip needed)
  useEffect(() => {
    loadProfile();
  }, [user]);

  useEffect(() => {
    const loadPushPref = async () => {
      try {
        const saved = await SecureStore.getItemAsync('push_enabled');
        if (saved !== null) {
          setPushEnabled(saved === 'true');
        }
      } catch {
        // Ignore — use default
      }
    };
    loadPushPref();
  }, []);

  const loadProfile = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone_number, role, avatar_url, wilaya, loyalty_points, is_phone_verified')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setProfileData(data);
        if (data.wilaya) setSelectedWilaya(data.wilaya);
      }
    } catch {
      // Profile load failed silently — UI shows default values
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter de votre compte ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.auth.signOut();
              clearAuth();
            } catch {
              // Sign out error — clear local auth anyway
              clearAuth();
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Supprimer le compte',
      'Cette action est irréversible. Toutes vos données, rendez-vous et historiques seront supprimés définitivement. Voulez-vous continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer définitivement',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete('/auth/me');
              await supabase.auth.signOut();
            } catch (error: unknown) {
              Alert.alert('Erreur', (error as Error).message || 'Impossible de supprimer le compte.');
            }
          },
        },
      ]
    );
  };

  const selectWilaya = async (w: string) => {
    const wilayaName = w.replace(/^\d+\s*-\s*/, '');
    setSelectedWilaya(wilayaName);
    setIsWilayaModalVisible(false);
    setWilayaSearch('');
    if (user) {
      setIsUpdating(true);
      try {
        // Update wilaya via API — not direct Supabase write
        await apiClient.patch('/auth/profiles/me', { wilaya: wilayaName });
      } catch {
        // Non-critical — setting will update on next profile load
      } finally {
        setIsUpdating(false);
      }
    }
  };

  const displayName = profileData?.full_name || user?.user_metadata?.full_name || 'Utilisateur';
  const displayPhone = profileData?.phone_number || user?.phone || user?.email || 'Non renseigné';
  const points = profileData?.loyalty_points ?? 0; // Show actual points from database

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.headerBar}>
        <Text style={styles.headerLogo}>7afefli</Text>
        <Text style={styles.headerTitle}>Paramètres</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* User Card — Tappable to edit */}
        <TouchableOpacity style={styles.profileCard} onPress={() => setIsEditProfileVisible(true)} activeOpacity={0.8}>
          <Image source={{ uri: profileData?.avatar_url || DEFAULT_AVATAR }} style={styles.avatar} />
          <View style={styles.profileMeta}>
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.userPhone}>{displayPhone}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>
                {role === 'Coiffeur' ? 'Coiffeur Professionnel' : 'Client Premium'}
              </Text>
            </View>
          </View>
          <Ionicons name="create-outline" size={20} color={colors.amber} />
        </TouchableOpacity>

        {/* Wilaya Picker — Client only */}
        {role === 'Client' && (
          <>
            <Text style={styles.sectionHeaderTitle}>Préférences de recherche</Text>
            <View style={styles.settingsGroup}>
              <TouchableOpacity style={styles.settingsRow} onPress={() => setIsWilayaModalVisible(true)} disabled={isUpdating}>
                <View style={styles.rowLeftCol}>
                  <Ionicons name="location-outline" size={20} color={colors.amber} />
                  <Text style={styles.rowLabel}>Wilaya de recherche</Text>
                </View>
                <View style={styles.rowRightCol}>
                  <Text style={styles.rowValue}>{selectedWilaya}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </View>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Settings Group 2: App switches */}
        <Text style={styles.sectionHeaderTitle}>Réglages Système</Text>
        <View style={styles.settingsGroup}>
          {/* Push notification */}
          <View style={styles.settingsRow}>
            <View style={styles.rowLeftCol}>
              <Ionicons name="notifications-outline" size={20} color={colors.amber} />
              <Text style={styles.rowLabel}>Notifications de rappel</Text>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={async (val: boolean) => {
                setPushEnabled(val);
                try {
                  await SecureStore.setItemAsync('push_enabled', String(val));
                } catch {
                  // Ignore storage errors
                }
              }}
              trackColor={{ false: colors.graphite, true: colors.amberDim }}
              thumbColor={pushEnabled ? colors.amber : colors.steel}
            />
          </View>

          {/* Dark Mode */}
          <View style={styles.settingsRow}>
            <View style={styles.rowLeftCol}>
              <Ionicons name="moon-outline" size={20} color={colors.amber} />
              <Text style={styles.rowLabel}>Thème sombre industriel</Text>
            </View>
            <Switch
              value={darkModeEnabled}
              onValueChange={(val) => {
                setDarkModeEnabled(val);
                if (!val) {
                  Alert.alert('Mode clair indisponible', 'L\'esthétique 7afefli est optimisée pour le thème sombre.');
                  setDarkModeEnabled(true);
                }
              }}
              trackColor={{ false: colors.graphite, true: colors.amberDim }}
              thumbColor={darkModeEnabled ? colors.amber : colors.steel}
            />
          </View>
        </View>

        {/* Settings Group 3: Help / About */}
        <Text style={styles.sectionHeaderTitle}>À propos</Text>
        <View style={styles.settingsGroup}>
          <TouchableOpacity style={styles.settingsRow} onPress={() => Alert.alert('Politique de confidentialité', '7afefli respecte votre vie privée. Vos données personnelles sont stockées de manière sécurisée sur des serveurs européens (Supabase) et ne sont jamais partagées avec des tiers sans votre consentement.\n\nDonnées collectées :\n• Nom, téléphone, e-mail\n• Localisation (pour trouver des salons proches)\n• Historique de réservations\n\nVous pouvez demander la suppression de vos données à tout moment depuis les paramètres.\n\nContact : contact@7afefli.com')}>
            <View style={styles.rowLeftCol}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.rowLabel}>Politique de confidentialité</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingsRow} onPress={() => Alert.alert('Conditions d\'utilisation', 'En utilisant 7afefli, vous acceptez les conditions suivantes :\n\n1. L\'application est destinée à la réservation de services de coiffure en Algérie.\n2. Les utilisateurs doivent fournir des informations exactes.\n3. Les annulations doivent être effectuées au moins 2 heures avant le rendez-vous.\n4. 7afefli n\'est pas responsable des litiges entre clients et salons.\n5. Tout comportement abusif pourra entraîner la suspension du compte.\n\nContact : contact@7afefli.com')}>
            <View style={styles.rowLeftCol}>
              <Ionicons name="document-text-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.rowLabel}>Conditions d'utilisation</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.settingsRow}>
            <View style={styles.rowLeftCol}>
              <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.rowLabel}>Version de l'application</Text>
            </View>
            <Text style={styles.versionText}>v1.0.2</Text>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={colors.amber} />
          <Text style={[styles.logoutText, { color: colors.amber }]}>Se déconnecter</Text>
        </TouchableOpacity>

        {/* Delete Account Button */}
        <TouchableOpacity style={[styles.logoutButton, { marginTop: spacing.md, borderColor: 'rgba(239, 68, 68, 0.3)' }]} onPress={handleDeleteAccount} activeOpacity={0.8}>
          <Ionicons name="trash-outline" size={20} color={colors.error} />
          <Text style={styles.logoutText}>Supprimer le compte</Text>
        </TouchableOpacity>

        {/* Branding Footer */}
        <View style={styles.brandingFooter}>
          <Text style={styles.brandingText}>Crafted in Algeria with Precision</Text>
          <Text style={styles.brandingSub}>© 2026 7afefli</Text>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <EditProfileModal
        visible={isEditProfileVisible}
        onClose={() => setIsEditProfileVisible(false)}
        profileData={profileData}
        onSaved={loadProfile}
      />

      {/* Wilaya Selection Modal */}
      <Modal visible={isWilayaModalVisible} animationType="slide" transparent onRequestClose={() => setIsWilayaModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setIsWilayaModalVisible(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Choisir la Wilaya</Text>
              <View style={{ width: 24 }} />
            </View>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={18} color={colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
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
                <TouchableOpacity style={styles.wilayaItem} onPress={() => selectWilaya(item)}>
                  <Text style={styles.wilayaText}>{item}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}
              contentContainerStyle={{ paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  headerBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerLogo: {
    fontFamily: 'Syne_700Bold',
    fontSize: 18,
    color: colors.amber,
  },
  headerTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    color: colors.textPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.amber,
  },
  profileMeta: {
    flex: 1,
  },
  userName: {
    fontFamily: 'Syne_700Bold',
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  userPhone: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
  },
  roleBadge: {
    backgroundColor: 'rgba(232, 160, 32, 0.12)',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginTop: 8,
  },
  roleBadgeText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 10,
    color: colors.amber,
    textTransform: 'uppercase',
  },
  sectionHeaderTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 14,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    paddingLeft: 4,
  },
  settingsGroup: {
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  rowLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: colors.textPrimary,
  },
  rowRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rowValue: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
    color: colors.amber,
  },
  versionText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.textMuted,
  },
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: 'rgba(231, 76, 60, 0.08)',
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(231, 76, 60, 0.15)',
    marginBottom: spacing.xl,
  },
  logoutText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    color: colors.error,
  },
  brandingFooter: {
    alignItems: 'center',
    marginBottom: 60,
  },
  brandingText: {
    fontFamily: 'Syne_600SemiBold',
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  brandingSub: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.ink,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 18,
    color: colors.textPrimary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.carbon,
    margin: spacing.lg,
    paddingHorizontal: spacing.md,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: 'DMSans_400Regular',
    marginLeft: spacing.sm,
  },
  wilayaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.02)',
  },
  wilayaText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
    color: colors.textPrimary,
  },
});
