// apps/mobile/src/components/ui/Rating.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../../theme';

interface RatingProps {
  rating: number;
  totalReviews?: number;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
}

export function Rating({
  rating,
  totalReviews,
  size = 'md',
  showCount = true,
}: RatingProps) {
  const starSize = size === 'sm' ? 12 : size === 'md' ? 16 : 22;
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  return (
    <View style={styles.container}>
      <View style={styles.stars}>
        {Array.from({ length: fullStars }).map((_, i) => (
          <Text key={`full-${i}`} style={{ fontSize: starSize, color: colors.amber }}>
            ★
          </Text>
        ))}
        {hasHalf && (
          <Text style={{ fontSize: starSize, color: colors.amber }}>★</Text>
        )}
        {Array.from({ length: emptyStars }).map((_, i) => (
          <Text key={`empty-${i}`} style={{ fontSize: starSize, color: colors.steel }}>
            ★
          </Text>
        ))}
      </View>
      <Text style={[styles.ratingNum, sizeStyles[size].text]}>
        {rating.toFixed(1)}
      </Text>
      {showCount && totalReviews !== undefined && (
        <Text style={styles.count}>({totalReviews})</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  stars: {
    flexDirection: 'row',
    gap: 1,
  },
  ratingNum: {
    color: colors.textPrimary,
    fontFamily: 'DMSans_700Bold',
  },
  count: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});

const sizeStyles = {
  sm: { text: { fontSize: 12 } },
  md: { text: { fontSize: 14 } },
  lg: { text: { fontSize: 18 } },
};
