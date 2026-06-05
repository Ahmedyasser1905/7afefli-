import React from 'react';
import { TouchableOpacity, View, Text, Image, StyleSheet } from 'react-native';
import { colors, typography, spacing, radius, shadows } from '../../theme';
import Ionicons from "@react-native-vector-icons/ionicons";
import type { Salon } from '@barberdz/shared/types';

interface SalonCardProps {
  salon: Salon;
  onPress: (salon: Salon) => void;
}

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80';
const DEFAULT_THUMB = 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=300&q=80';

export const SalonCard = React.memo(function SalonCard({ salon, onPress }: SalonCardProps) {
  const displayImage = salon.image_url || (salon.is_sponsored ? DEFAULT_COVER : DEFAULT_THUMB);

  if (salon.is_sponsored) {
    // Sponsored Card (Large Hero style)
    return (
      <TouchableOpacity
        style={styles.sponsoredCard}
        onPress={() => onPress(salon)}
        activeOpacity={0.85}
      >
        <View style={styles.heroImageContainer}>
          <Image source={{ uri: displayImage }} style={styles.heroImage} />
          <View style={styles.gradientOverlay} />
          {/* Sponsored badge */}
          <View style={styles.sponsoredBadge}>
            <Ionicons name="star" size={12} color={colors.ink} />
            <Text style={styles.sponsoredText}>Sponsorisé</Text>
          </View>
          {/* Distance badge inside image if available */}
          {salon.distance_km !== undefined && (
            <View style={styles.distanceBadgeFloating}>
              <Text style={styles.distanceTextFloating}>
                {salon.distance_km < 1
                  ? `${Math.round(salon.distance_km * 1000)}m`
                  : `${salon.distance_km.toFixed(1)} km`}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.heroInfoRow}>
          <View style={styles.heroLeftCol}>
            <Text style={styles.heroName} numberOfLines={1}>
              {salon.name}
            </Text>
            <View style={styles.locationRow}>
              <Ionicons name="location-sharp" size={14} color={colors.textSecondary} />
              <Text style={styles.heroAddress} numberOfLines={1}>
                {salon.address || `${salon.wilaya}, Algérie`}
              </Text>
            </View>
          </View>
          <View style={styles.heroRatingContainer}>
            <Ionicons name="star" size={14} color={colors.amber} style={{ marginRight: 2 }} />
            <Text style={styles.ratingText}>{salon.average_rating ? salon.average_rating.toFixed(1) : 'Nouveau'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // Regular Card (Horizontal Row style)
  return (
    <TouchableOpacity
      style={styles.regularCard}
      onPress={() => onPress(salon)}
      activeOpacity={0.8}
    >
      <Image source={{ uri: displayImage }} style={styles.thumbnail} />
      
      <View style={styles.regularInfo}>
        <View style={styles.regularTopRow}>
          <Text style={styles.regularName} numberOfLines={1}>
            {salon.name}
          </Text>
          <View style={styles.regularRatingRow}>
            <Ionicons name="star" size={12} color={colors.amber} />
            <Text style={styles.regularRatingText}>
              {salon.average_rating ? salon.average_rating.toFixed(1) : 'Nouveau'}
            </Text>
          </View>
        </View>

        <Text style={styles.regularDescription} numberOfLines={1}>
          {salon.address || `${salon.wilaya}, Algérie`}
        </Text>

        <View style={styles.regularBottomRow}>
          <Text style={styles.distanceLabel}>
            {salon.distance_km !== undefined
              ? salon.distance_km < 1
                ? `${Math.round(salon.distance_km * 1000)}m`
                : `${salon.distance_km.toFixed(1)}km de vous`
              : `${salon.wilaya}`}
          </Text>
          
          <View style={styles.viewSlotsButton}>
            <Text style={styles.viewSlotsText}>Réserver</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  sponsoredCard: {
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  heroImageContainer: {
    height: 160,
    position: 'relative',
    backgroundColor: colors.graphite,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 15, 15, 0.3)',
  },
  sponsoredBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.amber,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    gap: 4,
  },
  sponsoredText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 10,
    color: colors.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  distanceBadgeFloating: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(15, 15, 15, 0.85)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  distanceTextFloating: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    color: colors.textPrimary,
  },
  heroInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  heroLeftCol: {
    flex: 1,
    marginRight: spacing.md,
  },
  heroName: {
    fontFamily: 'Syne_700Bold',
    fontSize: 18,
    color: colors.amber,
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -2,
    gap: 2,
  },
  heroAddress: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
  },
  heroRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.graphite,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  ratingText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
    color: colors.textPrimary,
  },

  // Regular horizontal styles
  regularCard: {
    flexDirection: 'row',
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    gap: spacing.md,
    alignItems: 'center',
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    backgroundColor: colors.graphite,
  },
  regularInfo: {
    flex: 1,
    justifyContent: 'space-between',
    height: 80,
  },
  regularTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  regularName: {
    fontFamily: 'Syne_600SemiBold',
    fontSize: 16,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  regularRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  regularRatingText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    color: colors.textPrimary,
  },
  regularDescription: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  regularBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  distanceLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    color: colors.amber,
  },
  viewSlotsButton: {
    backgroundColor: colors.graphite,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  viewSlotsText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 11,
    color: colors.textPrimary,
  },
});
