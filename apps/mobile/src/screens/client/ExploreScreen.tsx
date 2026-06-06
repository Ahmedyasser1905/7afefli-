// @ts-nocheck
// apps/mobile/src/screens/client/ExploreScreen.tsx
// Full explore & search screen — map + search + filters + results

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { apiClient } from '../../lib/apiClient';
import { colors, spacing, radius } from '../../theme';
import { SalonCard } from '../../components/salon/SalonCard';
import { SalonMapView } from '../../components/map/SalonMapView';
import Ionicons from '@react-native-vector-icons/ionicons';
import type { Salon } from '@barberdz/shared/types';
import { WILAYAS_WITH_ALL } from '@barberdz/shared/constants/wilayas';
import { useMapPreferences } from '../../store/mapPreferencesStore';

const WILAYAS = WILAYAS_WITH_ALL;

const SORT_OPTIONS = [
  { id: 'rating', label: '⭐ Avis' },
  { id: 'distance', label: '📍 Distance' },
  { id: 'price', label: '💰 Prix' },
];

interface Coords {
  latitude: number;
  longitude: number;
}

export function ExploreScreen() {
  const navigation = useNavigation<Record<string, unknown>>();
  const {
    selectedWilaya, setSelectedWilaya,
    selectedSort, setSelectedSort,
    showMap, setShowMap,
  } = useMapPreferences();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [location, setLocation] = useState<Coords | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Get user location continuously
  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          locationSubscription = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.Balanced, distanceInterval: 5, timeInterval: 5000 },
            (loc) => {
              setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
            }
          );
        } else {
          setLocation({ latitude: 36.7538, longitude: 3.0588 });
        }
      } catch {
        setLocation({ latitude: 36.7538, longitude: 3.0588 });
      }
    })();

    return () => { locationSubscription?.remove(); };
  }, []);

  // Fetch salons — pass wilaya as query param when selected for server-side filtering
  const { data: allSalons = [], isLoading, error: queryError, refetch } = useQuery<Salon[]>({
    queryKey: ['explore-salons', selectedWilaya],
    queryFn: async () => {
      const wilayaParam = selectedWilaya !== 'Toutes'
        ? `&wilaya=${encodeURIComponent(selectedWilaya)}`
        : '';
      const data = await apiClient.get<Salon[]>(`/salons?limit=200${wilayaParam}`);
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Filter + search + sort (client-side, after server already narrowed by wilaya)
  const filteredSalons = useMemo(() => {
    let result = [...allSalons];

    // Secondary wilaya guard (in case backend doesn't support param yet)
    if (selectedWilaya !== 'Toutes') {
      result = result.filter(
        (s) => s.wilaya?.toLowerCase().trim() === selectedWilaya.toLowerCase().trim()
      );
    }

    // Text search
    if (debouncedQuery.trim().length > 0) {
      const q = debouncedQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.wilaya.toLowerCase().includes(q) ||
          (s.address && s.address.toLowerCase().includes(q)) ||
          (s.description && s.description.toLowerCase().includes(q))
      );
    }

    // Sort
    result.sort((a, b) => {
      if (selectedSort === 'rating') return b.average_rating - a.average_rating;
      if (selectedSort === 'distance' && location) {
        return getDistanceKm(location, a) - getDistanceKm(location, b);
      }
      if (a.is_sponsored !== b.is_sponsored) return a.is_sponsored ? -1 : 1;
      return b.average_rating - a.average_rating;
    });

    return result;
  }, [allSalons, selectedWilaya, debouncedQuery, selectedSort, location]);

  const handleSalonPress = useCallback(
    (salon: Salon) => {
      navigation.navigate('SalonDetail', { salonId: salon.id });
    },
    [navigation]
  );

  const handleMapSalonPress = useCallback(
    (salonId: string) => {
      navigation.navigate('SalonDetail', { salonId });
    },
    [navigation]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Search Header */}
      <View style={styles.searchHeader}>
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Ionicons
              name="search"
              size={18}
              color={colors.textSecondary}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher un salon, ville, service..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
              returnKeyType="search"
              onSubmitEditing={() => Keyboard.dismiss()}
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                activeOpacity={0.7}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Map toggle */}
          <TouchableOpacity
            style={[styles.mapToggle, showMap && styles.mapToggleActive]}
            onPress={() => setShowMap(!showMap)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={showMap ? 'map' : 'map-outline'}
              size={20}
              color={showMap ? colors.ink : colors.amber}
            />
          </TouchableOpacity>
        </View>

        {/* Wilaya filter pills */}
        <FlatList
          horizontal
          data={WILAYAS}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.wilayaList}
          renderItem={({ item }) => {
            const isActive = selectedWilaya === item;
            return (
              <TouchableOpacity
                style={[styles.wilayaPill, isActive && styles.wilayaPillActive]}
                onPress={() => setSelectedWilaya(item)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.wilayaText,
                    isActive && styles.wilayaTextActive,
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />

        {/* Sort bar */}
        <View style={styles.sortBar}>
          {SORT_OPTIONS.map((opt) => {
            const isActive = selectedSort === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[styles.sortChip, isActive && styles.sortChipActive]}
                onPress={() => setSelectedSort(opt.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.sortChipText,
                    isActive && styles.sortChipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}

          <View style={styles.resultsBadge}>
            <Text style={styles.resultsBadgeText}>
              {isLoading ? '...' : filteredSalons.length} résultat{filteredSalons.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      </View>

      {/* Interactive Map */}
      {showMap && (
        <SalonMapView
          salons={filteredSalons}
          userLocation={location}
          onSalonPress={handleMapSalonPress}
          height={200}
          style={styles.mapView}
        />
      )}

      {/* Results List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.amber} size="large" />
          <Text style={styles.loadingText}>Recherche en cours...</Text>
        </View>
      ) : queryError ? (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={56} color={colors.error} />
          <Text style={styles.emptyTitle}>Erreur de chargement</Text>
          <Text style={styles.emptySubtitle}>
            {queryError instanceof Error ? queryError.message : 'Une erreur est survenue'}
          </Text>
          <TouchableOpacity style={styles.resetButton} onPress={() => refetch()}>
            <Text style={styles.resetText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredSalons}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SalonCard salon={item} onPress={handleSalonPress} />
          )}
          contentContainerStyle={styles.resultsList}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isLoading}
          keyboardDismissMode="on-drag"
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={56} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Aucun salon trouvé</Text>
              <Text style={styles.emptySubtitle}>
                {debouncedQuery
                  ? `Aucun résultat pour "${debouncedQuery}"`
                  : selectedWilaya !== 'Toutes'
                  ? `Aucun salon à ${selectedWilaya}`
                  : 'Essayez de modifier vos filtres'}
              </Text>
              {(debouncedQuery || selectedWilaya !== 'Toutes') && (
                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={() => {
                    setSearchQuery('');
                    setSelectedWilaya('Toutes');
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh" size={16} color={colors.amber} />
                  <Text style={styles.resetText}>Réinitialiser</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

// Haversine distance for client-side sorting
function getDistanceKm(
  user: Coords,
  salon: { latitude: number; longitude: number }
): number {
  const R = 6371;
  const dLat = ((salon.latitude - user.latitude) * Math.PI) / 180;
  const dLon = ((salon.longitude - user.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((user.latitude * Math.PI) / 180) *
      Math.cos((salon.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  searchHeader: {
    backgroundColor: colors.ink,
    paddingTop: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
  },
  clearButton: {
    padding: 4,
  },
  mapToggle: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.carbon,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  mapToggleActive: {
    backgroundColor: colors.amber,
    borderColor: colors.amber,
  },
  wilayaList: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
  wilayaPill: {
    backgroundColor: colors.carbon,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  wilayaPillActive: {
    backgroundColor: 'rgba(232,160,32,0.15)',
    borderColor: colors.amber,
  },
  wilayaText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
  },
  wilayaTextActive: {
    color: colors.amber,
  },
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: 'transparent',
  },
  sortChipActive: {
    backgroundColor: 'rgba(232,160,32,0.1)',
  },
  sortChipText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    color: colors.textMuted,
  },
  sortChipTextActive: {
    color: colors.amber,
  },
  resultsBadge: {
    marginLeft: 'auto',
    backgroundColor: colors.carbon,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  resultsBadgeText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 10,
    color: colors.textSecondary,
  },
  mapView: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
  },
  resultsList: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    fontFamily: 'Syne_600SemiBold',
    fontSize: 18,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xl,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
    backgroundColor: 'rgba(232,160,32,0.12)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  resetText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
    color: colors.amber,
  },
});
