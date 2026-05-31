// apps/mobile/src/components/ui/Avatar.tsx

import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../../theme';

interface AvatarProps {
  uri?: string | null;
  name: string;
  size?: number;
  showOnlineIndicator?: boolean;
}

export function Avatar({ uri, name, size = 40, showOnlineIndicator = false }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
          accessibilityLabel={`Photo de ${name}`}
        />
      ) : (
        <View
          style={[
            styles.fallback,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        >
          <Text style={[styles.initials, { fontSize: size * 0.36 }]}>
            {initials}
          </Text>
        </View>
      )}
      {showOnlineIndicator && (
        <View style={[styles.onlineDot, { right: 0, bottom: 0 }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    resizeMode: 'cover',
  },
  fallback: {
    backgroundColor: colors.graphite,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.steel,
  },
  initials: {
    color: colors.amber,
    fontFamily: 'Syne_700Bold',
  },
  onlineDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.carbon,
  },
});
