// apps/mobile/src/screens/client/HomeScreen.tsx
// First impression — Map + nearby salon discovery

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { colors, typography, spacing, radius, shadows } from '../../theme';
import { useNearbySalons } from '../../hooks/salons/useNearbySalons';
import { SalonCard } from '../../components/salon/SalonCard';
import type { Salon } from '../../../../packages/shared/types';

// Filter pill options
const FILTER_OPTIONS = [
  { id: 'nearby', label: '📍 À proximité' },
  { id: 'top_rated', label: '⭐ 4+' },
  { id: 'beard', label: '🧔 Barbe' },
  { id: 'haircut', label: '✂️ Coupe' },
  { id: 'keratin', label: '✨ Kératine' },
];

interface Coords {
  latitude: number;
  longitude: number;
}

export function HomeScreen() {
  const navigation = useNavigation<any>();
  const [location, setLocation] = useState<Coords | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());

  // 1. Get user's current location
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Permission de localisation refusée');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    })();
  }, []);

  // 2. Fetch nearby salons
  const { data: salons = [], isLoading, refetch } = useNearbySalons(location);

  // 3. Client-side filter logic
  const filteredSalons = useMemo(() => {
    let result = [...salons];

    if (activeFilters.has('top_rated')) {
      result = result.filter((s) => s.average_rating >= 4);
    }

    // Sort: sponsored first, then by rating
    result.sort((a, b) => {
      if (a.is_sponsored !== b.is_sponsored) return a.is_sponsored ? -1 : 1;
      return b.average_rating - a.average_rating;
    });

    return result;
  }, [salons, activeFilters]);

  const toggleFilter = useCallback((filterId: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(filterId)) {
        next.delete(filterId);
      } else {
        next.add(filterId);
      }
      return next;
    });
  }, []);

  const handleSalonPress = useCallback(
    (salon: Salon) => {
      navigation.navigate('SalonDetail', { salonId: salon.id });
    },
    [navigation],
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>BarberDZ</Text>
        <Text style={styles.subtitle}>💈 Trouvez votre barbier</Text>
      </View>

      {/* Search Bar */}
      <TouchableOpacity
        style={styles.searchBar}
        onPress={() => navigation.navigate('Search')}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Rechercher un salon"
      >
        <Text style={styles.searchText}>🔍  Rechercher un salon...</Text>
      </TouchableOpacity>

      {/* Filter Pills */}
      <FlatList
        horizontal
        data={FILTER_OPTIONS}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterContainer}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterPill,
              activeFilters.has(item.id) && styles.filterPillActive,
            ]}
            onPress={() => toggleFilter(item.id)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterText,
                activeFilters.has(item.id) && styles.filterTextActive,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Map Placeholder (Mapbox integration point) */}
      <View style={styles.mapPlaceholder}>
        {location ? (
          <View style={styles.mapContent}>
            <Text style={styles.mapPin}>📍</Text>
            <Text style={styles.mapCoords}>
              {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
            </Text>
            <Text style={styles.mapLabel}>
              Carte Mapbox — {filteredSalons.length} salons trouvés
            </Text>
          </View>
        ) : locationError ? (
          <Text style={styles.errorText}>{locationError}</Text>
        ) : (
          <ActivityIndicator color={colors.amber} size="large" />
        )}
      </View>

      {/* Nearby Salons List */}
      <View style={styles.listSection}>
        <Text style={styles.sectionTitle}>
          Salons à proximité
          <Text style={styles.sectionCount}> ({filteredSalons.length})</Text>
        </Text>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.skeletonCard} />
            ))}
          </View>
        ) : (
          <FlatList
            data={filteredSalons}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <SalonCard salon={item} onPress={handleSalonPress} />
            )}
            contentContainerStyle={styles.salonList}
            showsVerticalScrollIndicator={false}
            onRefresh={refetch}
            refreshing={isLoading}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🏠</Text>
                <Text style={styles.emptyTitle}>Aucun salon trouvé</Text>
                <Text style={styles.emptySubtitle}>
                  Essayez d'élargir votre zone de recherche
                </Text>
              </View>
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.amber,
  },
  subtitle: {
    ...typography.bodyMd,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  searchBar: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.graphite,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  searchText: {
    ...typography.bodyMd,
    color: colors.textMuted,
  },
  filterContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  filterPill: {
    backgroundColor: colors.graphite,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.steel,
  },
  filterPillActive: {
    backgroundColor: colors.amberDim,
    borderColor: colors.amber,
  },
  filterText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.amber,
  },
  mapPlaceholder: {
    height: 180,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.steel,
    overflow: 'hidden',
  },
  mapContent: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  mapPin: {
    fontSize: 32,
  },
  mapCoords: {
    ...typography.caption,
    color: colors.textMuted,
  },
  mapLabel: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
  errorText: {
    ...typography.bodyMd,
    color: colors.error,
  },
  listSection: {
    flex: 1,
    paddingTop: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionCount: {
    color: colors.textSecondary,
    fontFamily: 'DMSans_400Regular',
  },
  salonList: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  loadingContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  skeletonCard: {
    height: 200,
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  emptySubtitle: {
    ...typography.bodyMd,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
