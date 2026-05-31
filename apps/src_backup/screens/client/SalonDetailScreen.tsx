// apps/mobile/src/screens/client/SalonDetailScreen.tsx
// Salon detail — info, gallery, reviews, "Book Now" CTA

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Linking,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { colors, typography, spacing, radius, shadows } from '../../theme';
import { Rating } from '../../components/ui/Rating';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { Card } from '../../components/ui/Card';
import { formatDZD, formatDuration, formatDate } from '../../../../packages/shared/utils/formatters';
import type { Salon, Service, Review, PortfolioPhoto, SalonStaff } from '../../../../packages/shared/types';

export function SalonDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { salonId } = route.params;

  // Fetch full salon detail with joins
  const { data: salon, isLoading } = useQuery<Salon>({
    queryKey: ['salon-detail', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salons')
        .select(`
          *,
          services (*),
          salon_staff (*, profiles:profile_id (full_name, avatar_url)),
          reviews (*, profiles:client_id (full_name, avatar_url))
        `)
        .eq('id', salonId)
        .single();
      if (error) throw error;
      return data as Salon;
    },
  });

  // Fetch portfolio photos
  const { data: photos = [] } = useQuery<PortfolioPhoto[]>({
    queryKey: ['salon-portfolio', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portfolio_photos')
        .select('*')
        .eq('salon_id', salonId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((photo: any) => ({
        ...photo,
        url: supabase.storage
          .from('portfolios')
          .getPublicUrl(photo.storage_path).data.publicUrl,
      }));
    },
  });

  if (isLoading || !salon) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.heroSkeleton} />
        <View style={styles.contentSkeleton} />
      </View>
    );
  }

  const services = (salon as any).services ?? [];
  const staff = (salon as any).salon_staff ?? [];
  const reviews = (salon as any).reviews ?? [];

  // Check if salon is currently open
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const isOpen = currentTime >= salon.open_time.substring(0, 5) && currentTime < salon.close_time.substring(0, 5);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero Image */}
        <View style={styles.heroContainer}>
          <Image
            source={{
              uri: `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/salon-covers/${salon.id}/cover.jpg`,
            }}
            style={styles.heroImage}
            defaultSource={require('../../assets/placeholder-salon.png')}
          />
          <View style={styles.heroOverlay}>
            <Text style={styles.heroName}>{salon.name}</Text>
            <Text style={styles.heroWilaya}>📍 {salon.wilaya}</Text>
          </View>
          {/* Back button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Retour"
          >
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <View style={styles.statusRow}>
            <Badge
              label={isOpen ? `Ouvert jusqu'à ${salon.close_time.substring(0, 5)}` : 'Fermé'}
              variant={isOpen ? 'confirmed' : 'cancelled'}
            />
            {salon.is_sponsored && <Badge label="⭐ Sponsorisé" variant="sponsored" />}
          </View>

          <Rating
            rating={salon.average_rating}
            totalReviews={salon.total_reviews}
            size="lg"
          />

          <TouchableOpacity
            style={styles.addressRow}
            onPress={() =>
              Linking.openURL(`geo:${salon.latitude},${salon.longitude}?q=${encodeURIComponent(salon.address)}`)
            }
          >
            <Text style={styles.addressIcon}>📍</Text>
            <Text style={styles.addressText}>{salon.address}</Text>
            <Text style={styles.navigateText}>Naviguer →</Text>
          </TouchableOpacity>

          <Text style={styles.workingHours}>
            🕐 {salon.open_time.substring(0, 5)} – {salon.close_time.substring(0, 5)}
          </Text>
        </View>

        {/* Staff */}
        {staff.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Équipe</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.staffRow}>
                {staff.map((s: any) => (
                  <View key={s.id} style={styles.staffItem}>
                    <Avatar
                      uri={s.profiles?.avatar_url}
                      name={s.profiles?.full_name ?? 'Barbier'}
                      size={56}
                    />
                    <Text style={styles.staffName} numberOfLines={1}>
                      {s.profiles?.full_name ?? 'Barbier'}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Services */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Services</Text>
          {services.map((service: Service) => (
            <Card key={service.id} style={styles.serviceRow}>
              <View style={styles.serviceInfo}>
                <Text style={styles.serviceName}>{service.service_name}</Text>
                <Text style={styles.serviceDuration}>
                  {formatDuration(service.duration_minutes)}
                </Text>
              </View>
              <Text style={styles.servicePrice}>{formatDZD(service.price)}</Text>
            </Card>
          ))}
        </View>

        {/* Portfolio Gallery */}
        {photos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Portfolio</Text>
            <FlatList
              horizontal
              data={photos}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <Image
                  source={{ uri: item.url }}
                  style={styles.galleryImage}
                  accessibilityLabel={item.caption ?? 'Photo du salon'}
                />
              )}
              contentContainerStyle={styles.galleryContainer}
            />
          </View>
        )}

        {/* Reviews */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Avis ({reviews.length})
          </Text>
          {reviews.slice(0, 5).map((review: any) => (
            <Card key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <Avatar
                  uri={review.profiles?.avatar_url}
                  name={review.profiles?.full_name ?? 'Client'}
                  size={32}
                />
                <View style={styles.reviewHeaderInfo}>
                  <Text style={styles.reviewerName}>
                    {review.profiles?.full_name ?? 'Client'}
                  </Text>
                  <Rating rating={review.rating} size="sm" showCount={false} />
                </View>
              </View>
              {review.comment && (
                <Text style={styles.reviewComment}>{review.comment}</Text>
              )}
            </Card>
          ))}
        </View>

        {/* Spacer for sticky button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sticky Book Button */}
      <View style={styles.stickyBottom}>
        <Button
          title="Réserver maintenant"
          onPress={() => navigation.navigate('Booking', { salonId: salon.id })}
          fullWidth
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink },
  loadingContainer: { flex: 1, backgroundColor: colors.ink },
  heroSkeleton: { height: 280, backgroundColor: colors.carbon },
  contentSkeleton: { flex: 1, margin: spacing.lg, backgroundColor: colors.carbon, borderRadius: radius.lg },
  heroContainer: { height: 280, position: 'relative' },
  heroImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  heroOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: spacing.lg,
    background: 'linear-gradient(transparent, rgba(15,15,15,0.95))',
    backgroundColor: 'rgba(15,15,15,0.7)',
  },
  heroName: { ...typography.h1, color: colors.textPrimary },
  heroWilaya: { ...typography.bodyMd, color: colors.amber, marginTop: spacing.xs },
  backButton: {
    position: 'absolute', top: 50, left: spacing.lg,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(15,15,15,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  backText: { fontSize: 22, color: colors.textPrimary },
  infoSection: { padding: spacing.lg, gap: spacing.sm },
  statusRow: { flexDirection: 'row', gap: spacing.sm },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  addressIcon: { fontSize: 16 },
  addressText: { ...typography.bodyMd, color: colors.textSecondary, flex: 1 },
  navigateText: { ...typography.label, color: colors.amber },
  workingHours: { ...typography.bodyMd, color: colors.textSecondary },
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.md },
  staffRow: { flexDirection: 'row', gap: spacing.md, paddingRight: spacing.lg },
  staffItem: { alignItems: 'center', width: 70 },
  staffName: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
  serviceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  serviceInfo: { flex: 1 },
  serviceName: { ...typography.bodyMd, color: colors.textPrimary, fontFamily: 'DMSans_500Medium' },
  serviceDuration: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  servicePrice: { ...typography.bodyMd, color: colors.amber, fontFamily: 'DMSans_700Bold' },
  galleryContainer: { gap: spacing.sm },
  galleryImage: { width: 160, height: 160, borderRadius: radius.md },
  reviewCard: { marginBottom: spacing.sm },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  reviewHeaderInfo: { flex: 1 },
  reviewerName: { ...typography.label, color: colors.textPrimary },
  reviewComment: { ...typography.bodyMd, color: colors.textSecondary },
  stickyBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: spacing.lg, paddingBottom: spacing.xxl,
    backgroundColor: colors.ink,
    borderTopWidth: 1, borderTopColor: colors.graphite,
    ...shadows.lg,
  },
});
