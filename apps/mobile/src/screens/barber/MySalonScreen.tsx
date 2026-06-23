import Toast from 'react-native-toast-message';
// apps/mobile/src/screens/barber/MySalonScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing, radius } from '../../theme';
import Ionicons from "@react-native-vector-icons/ionicons";
import * as ImagePicker from 'expo-image-picker';
import { ServiceModal } from '../../components/barber/ServiceModal';
import { AddStaffModal } from '../../components/barber/AddStaffModal';
import { EditSalonModal } from '../../components/barber/EditSalonModal';
import { EditSalonLocationModal } from '../../components/barber/EditSalonLocationModal';
import { formatDZD } from '@barberdz/shared/utils/formatters';
import { decode } from 'base64-arraybuffer';
import { apiClient } from '../../lib/apiClient';
import { supabase } from '../../lib/supabase';
import { useTranslations } from '../../hooks/useTranslations';

export function MySalonScreen() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const { t } = useTranslations();
  const [activeTab, setActiveTab] = useState<'services' | 'portfolio' | 'reviews' | 'staff'>('services');
  const [isServiceModalVisible, setIsServiceModalVisible] = useState(false);
  const [isStaffModalVisible, setIsStaffModalVisible] = useState(false);
  const [isEditSalonVisible, setIsEditSalonVisible] = useState(false);
  const [isEditLocationVisible, setIsEditLocationVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingService, setEditingService] = useState<Record<string, unknown> | null>(null);
  const [respondingReview, setRespondingReview] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');

  // Fetch salon via API (consistent with other screens)
  const { data: salon, isLoading: isSalonLoading } = useQuery<Record<string, unknown> | null>({
    queryKey: ['my-salon', user?.id],
    queryFn: async () => {
      return apiClient.get<Record<string, unknown>>('/salons/my-salon');
    },
    enabled: !!user,
    retry: false, // 404 = no salon yet — don't retry indefinitely
  });

  // Fetch services
  const { data: services = [], isLoading: isServicesLoading, refetch: refetchServices } = useQuery<Record<string, unknown>[]>({
    queryKey: ['salon-services', salon?.id],
    queryFn: async () => {
      return apiClient.get<Record<string, unknown>[]>(`/salons/${salon?.id}/services`);
    },
    enabled: !!salon,
  });

  // Fetch portfolio
  const { data: photos = [], refetch: refetchPortfolio } = useQuery<Record<string, unknown>[]>({
    queryKey: ['salon-portfolio', salon?.id],
    queryFn: async () => {
      return apiClient.get<Record<string, unknown>[]>(`/salons/${salon?.id}/portfolio`);
    },
    enabled: !!salon,
  });

  // Fetch reviews
  const { data: reviews = [], refetch: refetchReviews } = useQuery<Record<string, unknown>[]>({
    queryKey: ['salon-reviews', salon?.id],
    queryFn: async () => {
      return apiClient.get<Record<string, unknown>[]>(`/salons/${salon?.id}/reviews`);
    },
    enabled: !!salon,
  });

  // Fetch staff
  const { data: staff = [], refetch: refetchStaff } = useQuery<Record<string, unknown>[]>({
    queryKey: ['salon-staff', salon?.id],
    queryFn: async () => {
      return apiClient.get<Record<string, unknown>[]>(`/salons/${salon?.id}/staff`);
    },
    enabled: !!salon,
  });

  const removeStaff = async (staffId: string, name: string) => {
    Alert.alert(t('barber.remove_staff'), `${t('barber.remove_staff_confirm').replace('ce barbier', name)}`, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('barber.remove_staff'),
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`/salons/${salon?.id}/staff/${staffId}`);
            refetchStaff();
          } catch (err: unknown) {
            Toast.show({
              type: 'error',
              text1: t('common.error'),
              text2: (err as Error).message || t('barber.remove_staff_failed')
            });
          }
        },
      },
    ]);
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        await uploadPortfolioPhoto(result.assets[0].base64);
      }
    } catch (error) {
      
    }
  };

  const uploadPortfolioPhoto = async (base64Str: string) => {
    if (!salon) return;
    setUploading(true);

    try {
      const fileName = `photo_${Date.now()}.jpg`;

      // Step 1: Get a signed upload URL from our backend (quota-checked)
      const { signedUrl, storagePath } = await apiClient.post<{
        signedUrl: string;
        storagePath: string;
        token: string;
      }>(`/salons/${salon.id}/portfolio/upload-url`, { fileName });

      // Step 2: Upload directly to Supabase using the signed URL
      const byteArray = decode(base64Str);
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        body: byteArray,
        headers: { 'Content-Type': 'image/jpeg' },
      });

      if (!uploadRes.ok) {
        throw new Error(t('barber.upload_failed'));
      }

      // Step 3: Register the photo in the backend (creates the DB record)
      await apiClient.post(`/salons/${salon.id}/portfolio`, { storagePath });

      Toast.show({
        type: 'success',
        text1: t('common.success'),
        text2: t('barber.portfolio_added')
      });
      refetchPortfolio();
    } catch (err: unknown) {
      const msg = (err as Error).message || t('barber.portfolio_upload_error');
      if (msg.toLowerCase().includes('limit') || msg.toLowerCase().includes('plan')) {
        Alert.alert(t('barber.portfolio_limit_title'), msg, [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('barber.portfolio_limit_action'), onPress: () => navigation.navigate('Subscription' as never) }
        ]);
      } else {
        Toast.show({
          type: 'error',
          text1: t('common.error'),
          text2: msg
        });
      }
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (photoId: string, storagePath: string) => {
    Alert.alert(t('barber.delete_photo'), t('barber.delete_photo_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('barber.delete_photo'),
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`/salons/${salon?.id}/portfolio/${photoId}`);
            refetchPortfolio();
          } catch (err: unknown) {
            Toast.show({
              type: 'error',
              text1: t('common.error'),
              text2: (err as Error).message || t('barber.delete_failed')
            });
          }
        },
      },
    ]);
  };

  const pickStaffImage = async (staffId: string) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1], // Square for avatars
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        await uploadStaffAvatar(staffId, result.assets[0].base64);
      }
    } catch (error) {
      
    }
  };

  const uploadStaffAvatar = async (staffId: string, base64Str: string) => {
    if (!salon) return;
    setUploading(true);

    try {
      const fileName = `staff/${salon.id}/${staffId}-${Date.now()}.jpg`;
      
      // Upload to storage portfolio bucket
      const { error: uploadError } = await supabase.storage
        .from('portfolio')
        .upload(fileName, decode(base64Str), {
          contentType: 'image/jpeg',
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('portfolio')
        .getPublicUrl(fileName);

      const avatarUrl = publicUrlData.publicUrl;

      // Update staff record
      await apiClient.patch(`/salons/${salon.id}/staff/${staffId}/avatar`, {
        avatarUrl,
      });

      refetchStaff();
    } catch (err: unknown) {
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: (err as Error).message || t('barber.avatar_upload_error')
      });
    } finally {
      setUploading(false);
    }
  };

  const deleteService = async (id: string) => {
    Alert.alert(t('barber.delete_service'), t('barber.delete_service_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('barber.delete_service'),
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`/salons/${salon?.id}/services/${id}`);
            refetchServices();
          } catch (err: unknown) {
            Toast.show({
              type: 'error',
              text1: t('common.error'),
              text2: (err as Error).message || t('barber.delete_failed')
            });
          }
        }
      }
    ]);
  };

  if (isSalonLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.amber} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {salon?.image_url ? (
            <Image source={{ uri: salon.image_url as string }} style={styles.headerImage} />
          ) : (
            <View style={styles.headerImagePlaceholder}>
              <Ionicons name="business" size={20} color={colors.textMuted} />
            </View>
          )}
          <View>
            <Text style={styles.headerTitle}>{(salon?.name as string) || t('barber.my_salon')}</Text>
            <Text style={styles.headerSubtitle}>{salon?.wilaya as string} • {(salon?.open_time as string)?.substring(0,5)} - {(salon?.close_time as string)?.substring(0,5)}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => setIsEditLocationVisible(true)} activeOpacity={0.7}>
            <Ionicons name="location" size={18} color={colors.amber} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => setIsEditSalonVisible(true)} activeOpacity={0.7}>
            <Ionicons name="settings" size={18} color={colors.amber} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabContainer}>
        {(['services', 'staff', 'portfolio', 'reviews'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'services' ? t('barber.tab_services') : tab === 'staff' ? t('barber.tab_barbers') : tab === 'portfolio' ? t('barber.tab_portfolio') : t('barber.tab_reviews')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'services' && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.addBtn} onPress={() => setIsServiceModalVisible(true)}>
              <Ionicons name="add" size={20} color={colors.ink} />
              <Text style={styles.addBtnText}>{t('barber.add_service')}</Text>
            </TouchableOpacity>

            {isServicesLoading ? (
              <ActivityIndicator color={colors.amber} style={{ marginTop: 20 }} />
            ) : services.length === 0 ? (
              <Text style={styles.emptyText}>{t('barber.no_service')}</Text>
            ) : (
              services.map((service: Record<string, unknown>) => (
                <View key={service.id as string} style={styles.serviceCard}>
                  <View style={styles.serviceInfo}>
                    <Text style={styles.serviceName}>{service.service_name as string}</Text>
                    <Text style={styles.serviceDetail}>{service.duration_minutes as number} min • {formatDZD(service.price as number)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                    <TouchableOpacity onPress={() => { setEditingService(service); setIsServiceModalVisible(true); }} style={styles.deleteBtn}>
                      <Ionicons name="create-outline" size={20} color={colors.amber} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteService(service.id as string)} style={styles.deleteBtn}>
                      <Ionicons name="trash-outline" size={20} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'portfolio' && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.addBtn} onPress={pickImage} disabled={uploading}>
              {uploading ? (
                <ActivityIndicator color={colors.ink} size="small" />
              ) : (
                <>
                  <Ionicons name="camera" size={20} color={colors.ink} />
                  <Text style={styles.addBtnText}>{t('barber.add_photo')}</Text>
                </>
              )}
            </TouchableOpacity>

            {photos.length === 0 ? (
              <Text style={styles.emptyText}>{t('barber.no_photos')}</Text>
            ) : (
              <View style={styles.grid}>
                {photos.map((photo: Record<string, unknown>) => (
                  <View key={photo.id as string} style={styles.gridImageContainer}>
                    <Image source={{ uri: photo.url as string }} style={styles.gridImage} resizeMode="cover" />
                    <TouchableOpacity
                      style={styles.photoDeleteBtn}
                      onPress={() => deletePhoto(photo.id as string, photo.storage_path as string)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {activeTab === 'staff' && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.addBtn} onPress={() => setIsStaffModalVisible(true)}>
              <Ionicons name="person-add" size={20} color={colors.ink} />
              <Text style={styles.addBtnText}>{t('barber.add_barber')}</Text>
            </TouchableOpacity>

            {staff.length === 0 ? (
              <Text style={styles.emptyText}>{t('barber.no_barbers')}</Text>
            ) : (
              staff.map((member: Record<string, unknown>) => {
                const profiles = member.profiles as Record<string, unknown> | undefined;
                const avatarUrl = (member.avatar_url as string) || (profiles?.avatar_url as string);
                return (
                  <View key={member.id as string} style={styles.staffCard}>
                    <TouchableOpacity onPress={() => pickStaffImage(member.id as string)} activeOpacity={0.7} style={{ position: 'relative' }}>
                      <View style={styles.staffAvatar}>
                        {avatarUrl ? (
                          <Image source={{ uri: avatarUrl }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                        ) : (
                          <Ionicons name="person" size={24} color={colors.amber} />
                        )}
                      </View>
                      <View style={{ position: 'absolute', bottom: -4, right: -4, backgroundColor: colors.carbon, borderRadius: 12, padding: 2 }}>
                        <Ionicons name="camera" size={14} color={colors.textSecondary} />
                      </View>
                    </TouchableOpacity>
                    <View style={styles.staffInfo}>
                      <Text style={styles.staffName}>{(member.custom_name as string) || (profiles?.full_name as string) || t('barber.staff_fallback')}</Text>
                      <Text style={styles.staffPhone}>{(profiles?.phone_number as string) || t('barber.staff_no_account')}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => removeStaff(member.id as string, (member.custom_name as string) || (profiles?.full_name as string) || t('barber.staff_fallback'))}
                      style={styles.deleteBtn}
                    >
                      <Ionicons name="close-circle" size={22} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>
        )}

        {activeTab === 'reviews' && (
          <View style={styles.section}>
            {reviews.length === 0 ? (
              <Text style={styles.emptyText}>{t('barber.no_reviews')}</Text>
            ) : (
              reviews.map((review: Record<string, unknown>) => {
                const reviewProfiles = review.profiles as Record<string, unknown> | undefined;
                return (
                <View key={review.id as string} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewName}>{(reviewProfiles?.full_name as string) || t('barber.anonymous_client')}</Text>
                    <View style={styles.stars}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Ionicons
                          key={i}
                          name="star"
                          size={12}
                          color={i < (review.rating as number) ? colors.amber : colors.steel}
                        />
                      ))}
                    </View>
                  </View>
                  {Boolean(review.comment) && <Text style={styles.reviewComment}>{review.comment as string}</Text>}
                  {Boolean(review.response) && (
                    <View style={{ backgroundColor: 'rgba(232,160,32,0.08)', borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.amber }}>
                      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: colors.amber, marginBottom: 4 }}>{t('barber.your_reply')}</Text>
                      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: colors.textSecondary }}>{review.response as string}</Text>
                    </View>
                  )}
                  {!review.response && respondingReview !== (review.id as string) && (
                    <TouchableOpacity
                      onPress={() => { setRespondingReview(review.id as string); setResponseText(''); }}
                      style={{ alignSelf: 'flex-start', marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    >
                      <Ionicons name="chatbubble-outline" size={14} color={colors.amber} />
                      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: colors.amber }}>{t('barber.reply')}</Text>
                    </TouchableOpacity>
                  )}
                  {respondingReview === (review.id as string) && (
                    <View style={{ marginTop: spacing.sm }}>
                      <TextInput
                        style={{ backgroundColor: colors.ink, borderRadius: radius.sm, padding: spacing.sm, color: colors.textPrimary, fontFamily: 'DMSans_400Regular', fontSize: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', minHeight: 60, textAlignVertical: 'top' }}
                        placeholder={t('barber.reply_placeholder')}
                        placeholderTextColor={colors.textMuted}
                        value={responseText}
                        onChangeText={setResponseText}
                        multiline
                      />
                      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                        <TouchableOpacity onPress={() => setRespondingReview(null)} style={{ flex: 1, padding: spacing.sm, alignItems: 'center', borderRadius: radius.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: colors.textSecondary }}>{t('common.cancel')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          onPress={async () => {
                            try {
                              await apiClient.patch(`/reviews/${review.id as string}/response`, { response: responseText });
                              setRespondingReview(null);
                              setResponseText('');
                              refetchReviews();
                            } catch (err: unknown) {
                              Toast.show({
                                type: 'error',
                                text1: t('common.error'),
                                text2: (err as Error).message || t('barber.reply_error')
                              });
                            }
                          }}
                          style={{ flex: 1, padding: spacing.sm, alignItems: 'center', borderRadius: radius.sm, backgroundColor: colors.amber }}
                        >
                          <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 13, color: colors.ink }}>{t('barber.reply_send')}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {salon && (
        <>
          <ServiceModal
            visible={isServiceModalVisible}
            onClose={() => { setEditingService(null); setIsServiceModalVisible(false); }}
            salonId={salon.id as string}
            onSuccess={refetchServices}
            service={editingService as any}
          />
          <AddStaffModal
            visible={isStaffModalVisible}
            onClose={() => setIsStaffModalVisible(false)}
            salonId={salon.id as string}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['salon-staff', salon.id as string] });
              refetchStaff();
            }}
          />
          <EditSalonModal
            visible={isEditSalonVisible}
            onClose={() => setIsEditSalonVisible(false)}
            salon={salon}
            onSaved={() => {
              // Invalidate using the same key used to fetch the salon
              queryClient.invalidateQueries({ queryKey: ['my-salon', user?.id] });
            }}
          />
          <EditSalonLocationModal
            visible={isEditLocationVisible}
            onClose={() => setIsEditLocationVisible(false)}
            salon={salon}
            onSaved={() => {
              // Invalidate using the same key used to fetch the salon
              queryClient.invalidateQueries({ queryKey: ['my-salon', user?.id] });
            }}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.ink,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 22,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  headerImage: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
  },
  headerImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.graphite,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(232,160,32,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: spacing.lg,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: colors.amber,
  },
  tabText: {
    fontFamily: 'DMSans_500Medium',
    color: colors.textSecondary,
    fontSize: 14,
  },
  tabTextActive: {
    color: colors.amber,
    fontFamily: 'DMSans_700Bold',
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  section: {
    paddingBottom: spacing.xxl,
  },
  emptyText: {
    fontFamily: 'DMSans_400Regular',
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  addBtn: {
    flexDirection: 'row',
    backgroundColor: colors.amber,
    padding: spacing.md,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  addBtnText: {
    fontFamily: 'Syne_700Bold',
    color: colors.ink,
    fontSize: 15,
  },
  serviceCard: {
    backgroundColor: colors.carbon,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontFamily: 'Syne_700Bold',
    color: colors.textPrimary,
    fontSize: 16,
    marginBottom: 4,
  },
  serviceDetail: {
    fontFamily: 'DMSans_400Regular',
    color: colors.textSecondary,
    fontSize: 13,
  },
  deleteBtn: {
    padding: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridImageContainer: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: radius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
    borderRadius: radius.sm,
    backgroundColor: colors.graphite,
  },
  photoDeleteBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  reviewCard: {
    backgroundColor: colors.carbon,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  reviewName: {
    fontFamily: 'Syne_700Bold',
    color: colors.textPrimary,
    fontSize: 15,
  },
  stars: {
    flexDirection: 'row',
  },
  reviewComment: {
    fontFamily: 'DMSans_400Regular',
    color: colors.textSecondary,
    fontSize: 14,
  },
  staffCard: {
    backgroundColor: colors.carbon,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: spacing.md,
  },
  staffAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(232,160,32,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    fontFamily: 'Syne_700Bold',
    color: colors.textPrimary,
    fontSize: 15,
    marginBottom: 2,
  },
  staffPhone: {
    fontFamily: 'DMSans_400Regular',
    color: colors.textSecondary,
    fontSize: 13,
  },
});
