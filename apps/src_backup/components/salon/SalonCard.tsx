// apps/mobile/src/components/salon/SalonCard.tsx
// Salon list card for HomeScreen and SearchScreen

import React from 'react';
import { TouchableOpacity, View, Text, Image, StyleSheet } from 'react-native';
import { colors, typography, spacing, radius, shadows } from '../../theme';
import { Rating } from '../ui/Rating';
import { Badge } from '../ui/Badge';
import type { Salon } from '../../../../packages/shared/types';

interface SalonCardProps {
  salon: Salon;
  onPress: (salon: Salon) => void;
}

export const SalonCard = React.memo(function SalonCard({ salon, onPress }: SalonCardProps) {
  const coverUrl = salon.id
    ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/salon-covers/${salon.id}/cover.jpg`
    : null;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(salon)}
      activeOpacity={0.8}
      accessibilityLabel={`${salon.name}, ${salon.wilaya}`}
    >
      {/* Cover Image */}
      <View style={styles.imageContainer}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={styles.coverImage} />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Text style={styles.coverPlaceholderText}>💈</Text>
          </View>
        )}
        {/* Sponsored badge */}
        {salon.is_sponsored && (
          <View style={styles.sponsoredBadge}>
            <Text style={styles.sponsoredText}>⭐ Sponsorisé</Text>
          </View>
        )}
        {/* Distance badge */}
        {salon.distance_km !== undefined && (
          <View style={styles.distanceBadge}>
            <Text style={styles.distanceText}>
              {salon.distance_km < 1
                ? `${Math.round(salon.distance_km * 1000)}m`
                : `${salon.distance_km.toFixed(1)} km`}
            </Text>
          </View>
        )}
      </View>

      {/* Info Section */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {salon.name}
          </Text>
          <Badge label={salon.wilaya} variant="active" />
        </View>
        <Rating
          rating={salon.average_rating}
          totalReviews={salon.total_reviews}
          size="sm"
        />
        <Text style={styles.address} numberOfLines={1}>
          {salon.address}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...shadows.md,
  },
  imageContainer: {
    height: 140,
    backgroundColor: colors.graphite,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.graphite,
  },
  coverPlaceholderText: {
    fontSize: 40,
  },
  sponsoredBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: 'rgba(232, 160, 32, 0.9)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  sponsoredText: {
    ...typography.caption,
    color: colors.ink,
    fontFamily: 'DMSans_700Bold',
  },
  distanceBadge: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(15, 15, 15, 0.8)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  distanceText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontFamily: 'DMSans_500Medium',
  },
  info: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    ...typography.h3,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  address: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
});
