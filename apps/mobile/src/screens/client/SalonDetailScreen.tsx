import Toast from 'react-native-toast-message';
// apps/mobile/src/screens/client/SalonDetailScreen.tsx
// Salon detail — info, gallery, reviews, "Book Now" CTA

import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Alert,
  Modal,
  Dimensions,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient';
import { colors, spacing, radius, shadows } from '../../theme';
import Ionicons from "@react-native-vector-icons/ionicons";
import type { Salon, Service, Review, PortfolioPhoto } from '@barberdz/shared/types';

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80';
const DEFAULT_AVATAR = 'https://phfwutugsyiutqgippqg.supabase.co/storage/v1/object/public/portfolio/defaults/default-avatar.png';

export function SalonDetailScreen() {
  const route = useRoute<Record<string, unknown>>();
  const navigation = useNavigation<Record<string, unknown>>();
  const { salonId } = route.params;

  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [isFavorited, setIsFavorited] = useState(false);
  const [isFavoritingLoading, setIsFavoritingLoading] = useState(false);
  const [showAllPhotos, setShowAllPhotos] = useState(false);
  const [viewerPhoto, setViewerPhoto] = useState<string | null>(null);

  // Check if this salon is already favorited on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await apiClient.get<{ favorited: boolean }>(`/salons/${salonId}/favorited`);
        if (!cancelled) setIsFavorited(result?.favorited ?? false);
      } catch {
        // Not authenticated or error — silently ignore
      }
    })();
    return () => { cancelled = true; };
  }, [salonId]);

  // Toggle favorite state and persist to server
  const handleFavoriteToggle = async () => {
    if (isFavoritingLoading) return;
    setIsFavoritingLoading(true);
    try {
      if (isFavorited) {
        await apiClient.delete(`/salons/${salonId}/favorite`);
        setIsFavorited(false);
      } else {
        await apiClient.post(`/salons/${salonId}/favorite`, {});
        setIsFavorited(true);
      }
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Impossible de modifier vos favoris. Connectez-vous d\'abord.'
      });
    } finally {
      setIsFavoritingLoading(false);
    }
  };

  // Fetch full salon detail
  const { data: salon, isLoading } = useQuery<Salon>({
    queryKey: ['salon-detail', salonId],
    queryFn: async () => {
      const data = await apiClient.get<Salon>(`/salons/${salonId}`);
      return data;
    },
    staleTime: 3 * 60 * 1000, // 3 min — avoid re-fetching the heavy join
  });

  // Fetch portfolio photos via API only — no Supabase fallback
  const { data: photos = [] } = useQuery<PortfolioPhoto[]>({
    queryKey: ['salon-portfolio', salonId],
    queryFn: async () => {
      return await apiClient.get<PortfolioPhoto[]>(`/salons/${salonId}/portfolio`);
    },
    staleTime: 3 * 60 * 1000,
  });

  // Toggle service selection (Only one service can be selected at a time)
  const toggleService = (id: string) => {
    setSelectedServices((prev) => {
      const next = new Set<string>();
      // If clicking the currently selected service, it will deselect it (leave empty).
      // If clicking a different service, it selects only that new service.
      if (!prev.has(id)) {
        next.add(id);
      }
      return next;
    });
  };

  const services = (salon as Record<string, unknown>)?.services ?? [];
  const staff = (salon as Record<string, unknown>)?.salon_staff ?? [];
  const reviews = (salon as Record<string, unknown>)?.reviews ?? [];

  // Calculate estimated price
  const estimatedPrice = useMemo(() => {
    let total = 0;
    services.forEach((s: Service) => {
      if (selectedServices.has(s.id)) {
        total += s.price;
      }
    });
    return total;
  }, [services, selectedServices]);

  // Handle share
  const handleShare = async () => {
    if (!salon) return;
    try {
      await Share.share({
        message: `Découvrez le salon ${salon.name} sur 7afefli ! Réservez votre créneau en quelques clics.`,
      });
    } catch {
      // Share dismissed or failed — no user-visible error needed
    }
  };

  if (isLoading || !salon) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.amber} size="large" />
      </View>
    );
  }

  // Open hours status
  const openTimeStr = salon.open_time ? salon.open_time.substring(0, 5) : '09:00';
  const closeTimeStr = salon.close_time ? salon.close_time.substring(0, 5) : '20:00';
  const isOpen = !!salon.is_currently_open;

  const displayCover = salon.image_url || DEFAULT_COVER;

  const handleBookingPress = () => {
    if (selectedServices.size === 0) {
      Toast.show({
        type: 'info',
        text1: 'Sélectionnez un service',
        text2: 'Veuillez sélectionner au moins un service pour continuer la réservation.'
      });
      return;
    }
    // Navigate to Booking screen and pass the selected service IDs
    navigation.navigate('Booking', {
      salonId: salon.id,
      selectedServiceIds: Array.from(selectedServices),
      estimatedPrice,
    });
  };

  return (
    <>
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Parallax Hero Header */}
        <View style={styles.heroContainer}>
          <Image source={{ uri: displayCover }} style={styles.heroImage} />
          <View style={styles.gradientOverlay} />

          {/* Floating Top Controls */}
          <SafeAreaView style={styles.headerControls}>
            <TouchableOpacity
              style={styles.circleButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>

            <View style={styles.headerControlsRight}>
              <TouchableOpacity style={styles.circleButton} onPress={handleShare} activeOpacity={0.7}>
                <Ionicons name="share-social" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.circleButton}
                onPress={handleFavoriteToggle}
                activeOpacity={0.7}
                disabled={isFavoritingLoading}
              >
                <Ionicons
                  name={isFavorited ? 'heart' : 'heart-outline'}
                  size={20}
                  color={isFavorited ? colors.error : colors.textPrimary}
                />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>

        {/* Info Card Overlapping the Hero */}
        <View style={styles.infoCardWrapper}>
          <View style={styles.infoCard}>
            <View style={styles.infoTitleRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 12 }}>
                <Text style={[styles.salonName, { flex: 0, flexShrink: 1 }]}>{salon.name}</Text>
                {salon.has_premium_badge && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.amber} style={{ marginLeft: 6 }} />
                )}
              </View>
              {(() => {
                const label = salon.status_label;
                let text = 'Fermé';
                let dotStyle = styles.dotRed;
                let textStyle = styles.textRed;
                let badgeStyle = styles.statusBadgeClosed;

                if (label === 'manually_closed') {
                  text = 'Fermeture temporaire';
                  dotStyle = styles.dotOrange;
                  textStyle = styles.textOrange;
                  badgeStyle = styles.statusBadgeWarning;
                } else if (label === 'open_24h') {
                  text = '24H/24';
                  dotStyle = styles.dotGreen;
                  textStyle = styles.textGreen;
                  badgeStyle = styles.statusBadgeOpen;
                } else if (label === 'open') {
                  text = `Ouvert • Ferme à ${closeTimeStr}`;
                  dotStyle = styles.dotGreen;
                  textStyle = styles.textGreen;
                  badgeStyle = styles.statusBadgeOpen;
                } else {
                  text = `Fermé • Ouvre à ${openTimeStr}`;
                  dotStyle = styles.dotRed;
                  textStyle = styles.textRed;
                  badgeStyle = styles.statusBadgeClosed;
                }

                return (
                  <View style={[styles.statusBadge, badgeStyle]}>
                    <View style={[styles.statusDot, dotStyle]} />
                    <Text style={[styles.statusText, textStyle]}>
                      {text}
                    </Text>
                  </View>
                );
              })()}
            </View>

            <View style={styles.infoMetaRow}>
              <View style={styles.metaItem}>
                <Ionicons name="star" size={16} color={colors.amber} />
                <Text style={styles.metaTextBold}>
                  {salon.average_rating ? salon.average_rating.toFixed(1) : 'Nouveau'}
                </Text>
                <Text style={styles.metaTextSecondary}>({salon.total_reviews || 0} avis)</Text>
              </View>

              <View style={styles.metaItem}>
                <Ionicons name="location" size={16} color={colors.textSecondary} />
                <Text style={styles.metaTextSecondary}>{salon.address || `${salon.wilaya}`}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Portfolio Gallery Grid */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Portfolio</Text>
            {photos.length > 0 && (
              <TouchableOpacity activeOpacity={0.7} onPress={() => setShowAllPhotos(!showAllPhotos)}>
                <Text style={styles.seeAllText}>{showAllPhotos ? 'Réduire' : 'Voir tout'}</Text>
              </TouchableOpacity>
            )}
          </View>

          {photos.length > 0 ? (
            showAllPhotos ? (
              <View style={styles.portfolioGrid}>
                {photos.map((item) => (
                  <TouchableOpacity key={item.id} style={styles.portfolioGridItem} activeOpacity={0.85} onPress={() => setViewerPhoto(item.url ?? null)}>
                    <Image source={{ uri: item.url }} style={styles.portfolioPhoto} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.portfolioScroll}>
                {photos.map((item) => (
                  <TouchableOpacity key={item.id} style={styles.portfolioPhotoContainer} activeOpacity={0.85} onPress={() => setViewerPhoto(item.url ?? null)}>
                    <Image source={{ uri: item.url }} style={styles.portfolioPhoto} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )
          ) : (
            <View style={styles.emptyPortfolioBox}>
              <Text style={styles.emptySectionText}>Aucune photo disponible</Text>
            </View>
          )}
        </View>

        {/* Services List (Interactive Selectable items) */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Nos Services</Text>
          <View style={styles.servicesList}>
            {services.map((service: Service) => {
              const isSelected = selectedServices.has(service.id);
              return (
                <TouchableOpacity
                  key={service.id}
                  style={[styles.serviceRow, isSelected && styles.serviceRowActive]}
                  onPress={() => toggleService(service.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.serviceInfo}>
                    <Text style={[styles.serviceName, isSelected && styles.serviceNameActive]}>
                      {service.service_name}
                    </Text>
                    <Text style={styles.serviceDuration}>
                      {service.duration_minutes} min • Soin traditionnel
                    </Text>
                  </View>
                  <View style={styles.servicePriceRow}>
                    <Text style={[styles.servicePrice, isSelected && styles.servicePriceActive]}>
                      {service.price} DZD
                    </Text>
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'add-circle-outline'}
                      size={24}
                      color={isSelected ? colors.amber : colors.textSecondary}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Team Members */}
        {staff.length > 0 && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Rencontrez l'équipe</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.teamScroll}>
              {staff.map((member: Record<string, unknown>) => {
                const displayName = member.custom_name || member.profiles?.full_name?.split(' ')[0] || 'Barbier';
                const avatar = member.avatar_url || member.profiles?.avatar_url || DEFAULT_AVATAR;
                return (
                  <View key={member.id} style={styles.teamItem}>
                    <View style={styles.avatarBorder}>
                      <Image
                        source={{ uri: avatar }}
                        style={styles.teamAvatar}
                      />
                    </View>
                    <Text style={styles.teamName} numberOfLines={1}>
                      {displayName}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Reviews Section */}
        <View style={[styles.sectionContainer, { marginBottom: 120 }]}>
          <Text style={styles.sectionTitle}>Avis clients ({reviews.length})</Text>
          {reviews.length > 0 ? (
            reviews.slice(0, 3).map((review: Record<string, unknown>) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Image
                    source={{ uri: review.profiles?.avatar_url || DEFAULT_AVATAR }}
                    style={styles.reviewerAvatar}
                  />
                  <View style={styles.reviewerMeta}>
                    <Text style={styles.reviewerName}>
                      {review.profiles?.full_name || 'Client anonyme'}
                    </Text>
                    <View style={styles.reviewerRating}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Ionicons
                          key={i}
                          name="star"
                          size={12}
                          color={i < review.rating ? colors.amber : colors.steel}
                        />
                      ))}
                    </View>
                  </View>
                </View>
                {review.comment && <Text style={styles.reviewComment}>{review.comment}</Text>}
              </View>
            ))
          ) : (
            <View style={styles.emptyReviewsBox}>
              <Text style={styles.emptySectionText}>Aucun avis pour le moment</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky Bottom Booking Action */}
      <View style={styles.bottomActionBar}>
        <View style={styles.priceContainer}>
          <Text style={styles.priceLabel}>Prix Estimé</Text>
          <Text style={styles.priceValue}>{estimatedPrice} DZD</Text>
        </View>
        {salon.is_manually_closed ? (
          <View style={[styles.bookButton, styles.bookButtonDisabled, { flexDirection: 'row', gap: 6, opacity: 0.8 }]}>
            <Ionicons name="close-circle-outline" size={20} color={colors.ink} />
            <Text style={styles.bookButtonText}>Salon temporairement fermé</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.bookButton, selectedServices.size === 0 && styles.bookButtonDisabled]}
            onPress={handleBookingPress}
            activeOpacity={0.8}
          >
            <Text style={styles.bookButtonText}>Continuer</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.ink} style={{ marginLeft: spacing.sm }} />
          </TouchableOpacity>
        )}
      </View>
    </View>

      {/* Fullscreen Photo Viewer Modal */}
      <Modal visible={!!viewerPhoto} transparent animationType="fade" onRequestClose={() => setViewerPhoto(null)}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.viewerOverlay}>
          <TouchableOpacity style={styles.viewerCloseBtn} onPress={() => setViewerPhoto(null)} activeOpacity={0.7}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <ScrollView
            contentContainerStyle={styles.viewerScrollContent}
            maximumZoomScale={5}
            minimumZoomScale={1}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            bouncesZoom={true}
            centerContent={true}
          >
            {viewerPhoto && (
              <Image
                source={{ uri: viewerPhoto }}
                style={styles.viewerImage}
                resizeMode="contain"
              />
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
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
  heroContainer: {
    height: 260,
    position: 'relative',
    backgroundColor: colors.graphite,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 15, 15, 0.4)',
  },
  headerControls: {
    position: 'absolute',
    top: 15,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  headerControlsRight: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  circleButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: 'rgba(15, 15, 15, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCardWrapper: {
    paddingHorizontal: spacing.lg,
    marginTop: -30,
    zIndex: 30,
  },
  infoCard: {
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  infoTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  salonName: {
    fontFamily: 'Syne_700Bold',
    fontSize: 22,
    color: colors.textPrimary,
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  statusBadgeOpen: {
    backgroundColor: 'rgba(46, 204, 113, 0.12)',
  },
  statusBadgeClosed: {
    backgroundColor: 'rgba(231, 76, 60, 0.12)',
  },
  statusBadgeWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  dotGreen: {
    backgroundColor: colors.success,
  },
  dotRed: {
    backgroundColor: colors.error,
  },
  dotOrange: {
    backgroundColor: '#F59E0B',
  },
  statusText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 11,
  },
  textGreen: {
    color: colors.success,
  },
  textRed: {
    color: colors.error,
  },
  textOrange: {
    color: '#F59E0B',
  },
  infoMetaRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaTextBold: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    color: colors.textPrimary,
  },
  metaTextSecondary: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
  },
  sectionContainer: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  seeAllText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
    color: colors.amber,
  },
  portfolioScroll: {
    gap: spacing.sm,
  },
  portfolioPhotoContainer: {
    width: 130,
    height: 130,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  portfolioPhoto: {
    width: '100%',
    height: '100%',
  },
  portfolioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  portfolioGridItem: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  emptyPortfolioBox: {
    height: 80,
    backgroundColor: colors.carbon,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptySectionText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.textMuted,
  },
  servicesList: {
    gap: spacing.sm,
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  serviceRowActive: {
    borderColor: colors.amber,
    backgroundColor: '#1E1A14',
  },
  serviceInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  serviceName: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  serviceNameActive: {
    color: colors.amber,
  },
  serviceDuration: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  servicePriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  servicePrice: {
    fontFamily: 'Syne_700Bold',
    fontSize: 15,
    color: colors.textPrimary,
  },
  servicePriceActive: {
    color: colors.amber,
  },
  teamScroll: {
    gap: spacing.md,
  },
  teamItem: {
    alignItems: 'center',
    width: 72,
  },
  avatarBorder: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.amber,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: radius.full,
  },
  teamName: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    color: colors.textPrimary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  reviewCard: {
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: spacing.sm,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  reviewerAvatar: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.graphite,
  },
  reviewerMeta: {
    flex: 1,
  },
  reviewerName: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
    color: colors.textPrimary,
  },
  reviewerRating: {
    flexDirection: 'row',
    marginTop: 2,
  },
  reviewComment: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  emptyReviewsBox: {
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
    padding: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  bottomActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 15, 15, 0.85)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  priceContainer: {
    flex: 1,
  },
  priceLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  priceValue: {
    fontFamily: 'Syne_700Bold',
    fontSize: 20,
    color: colors.amber,
    marginTop: 2,
  },
  bookButton: {
    backgroundColor: colors.amber,
    height: 54,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    ...shadows.amber,
  },
  bookButtonDisabled: {
    backgroundColor: colors.amberDim,
    opacity: 0.6,
  },
  bookButtonText: {
    fontFamily: 'Syne_600SemiBold',
    fontSize: 16,
    color: colors.ink,
  },
  viewerOverlay: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerScrollContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height * 0.8,
  },
});
