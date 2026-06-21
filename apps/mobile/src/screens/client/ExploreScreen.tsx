// apps/mobile/src/screens/client/ExploreScreen.tsx
// Full explore & search screen — map + search + filters + results

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
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
import { getDistanceKm } from '@barberdz/shared/utils/formatters';
import { useTranslations } from '../../hooks/useTranslations';

const WILAYAS = WILAYAS_WITH_ALL;

interface Coords {
  latitude: number;
  longitude: number;
}

export function ExploreScreen() {
  const navigation = useNavigation<any>();
  const {
    selectedWilaya, setSelectedWilaya,
    selectedSort, setSelectedSort,
    showMap, setShowMap,
  } = useMapPreferences();
  const { t, isRTL } = useTranslations();

  const SORT_OPTIONS = useMemo(() => [
    { id: 'rating', label: t('explore.sort_rating') },
    { id: 'distance', label: t('explore.sort_distance') },
    { id: 'price', label: t('explore.sort_price') },
  ], [t]);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [location, setLocation] = useState<Coords | null>(null);
  const [selectedSalonId, setSelectedSalonId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const lastLocationRef = useRef<Coords | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Get user location continuously
  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;
    let isMounted = true;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!isMounted) return;
        if (status === 'granted') {
          locationSubscription = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.Balanced, distanceInterval: 50, timeInterval: 30000 },
            (loc) => {
              if (!isMounted) return;
              const { latitude, longitude } = loc.coords;
              const prev = lastLocationRef.current;
              if (
                prev &&
                Math.abs(prev.latitude - latitude) < 0.00045 &&
                Math.abs(prev.longitude - longitude) < 0.00045
              ) return;
              const newCoords = { latitude, longitude };
              lastLocationRef.current = newCoords;
              setLocation(newCoords);
            }
          );
        } else {
          setLocation({ latitude: 36.7538, longitude: 3.0588 });
        }
      } catch {
        if (isMounted) {
          setLocation({ latitude: 36.7538, longitude: 3.0588 });
        }
      }
    })();

    return () => { 
      isMounted = false;
      locationSubscription?.remove(); 
      setSelectedSalonId(null);
    };
  }, []);

  // Fetch salons — pass wilaya as query param when selected for server-side filtering
  const { data: allSalonsResponse, isLoading, error: queryError, refetch } = useQuery({
    queryKey: ['explore-salons', selectedWilaya],
    queryFn: async () => {
      const wilayaParam = selectedWilaya !== 'Toutes'
        ? `&wilaya=${encodeURIComponent(selectedWilaya)}`
        : '';
      const data = await apiClient.get<any>(`/salons?limit=200${wilayaParam}`);
      return data;
    },
    staleTime: 10 * 60 * 1000,      // data stays fresh for 10 min
    gcTime: 30 * 60 * 1000,          // keep in cache for 30 min
    refetchOnWindowFocus: false,      // don't refetch when app comes to foreground
    refetchOnReconnect: false,        // don't refetch on network reconnect
    retry: 1,                         // only retry once on failure
  });

  const allSalons = useMemo(() => {
    if (!allSalonsResponse) return [];
    // API always returns { data: [], total, page, limit } — never a raw array
    return (allSalonsResponse as any).data ?? [];
  }, [allSalonsResponse]);

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
          (s.name && s.name.toLowerCase().includes(q)) ||
          (s.wilaya && s.wilaya.toLowerCase().includes(q)) ||
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
      if (selectedSort === 'price') {
        const getMinPrice = (salon: Salon) => {
          if (!salon.services || salon.services.length === 0) return Infinity;
          return Math.min(...salon.services.map((s) => s.price));
        };
        return getMinPrice(a) - getMinPrice(b);
      }
      const priceA = a.plan_price ?? 0;
      const priceB = b.plan_price ?? 0;
      if (priceA !== priceB) return priceB - priceA;
      return b.average_rating - a.average_rating;
    });

    return result;
  }, [allSalons, selectedWilaya, debouncedQuery, selectedSort, location]);

  // Reset selected salon when the filtered list changes so the map popup
  // never lingers for a salon that has been filtered out
  useEffect(() => {
    setSelectedSalonId(prev => {
      if (prev && !filteredSalons.some(s => s.id === prev)) return null;
      return prev;
    });
  }, [filteredSalons]);

  const handleSalonPress = useCallback(
    (salon: Salon) => {
      if (selectedSalonId === salon.id) {
        navigation.navigate('SalonDetail', { salonId: salon.id });
      } else {
        setSelectedSalonId(salon.id);
      }
    },
    [selectedSalonId, navigation]
  );

  const handleMapSalonPress = useCallback(
    (salonId: string) => {
      navigation.navigate('SalonDetail', { salonId });
    },
    [navigation]
  );

  const handleMarkerClick = useCallback(
    (salonId: string) => {
      setSelectedSalonId(salonId);
      const index = filteredSalons.findIndex((s) => s.id === salonId);
      if (index >= 0) {
        flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      }
    },
    [filteredSalons],
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
              placeholder={t('explore.search_placeholder')}
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
                onPress={() => setSelectedSort(opt.id as 'rating' | 'distance' | 'price')}
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
              {isLoading ? '...' : filteredSalons.length} {t('explore.results_count')}
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
          onMarkerClick={handleMarkerClick}
          onPopupClose={() => setSelectedSalonId(null)}
          selectedSalonId={selectedSalonId}
          height={200}
          style={styles.mapView}
        />
      )}

      {/* Results List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.amber} size="large" />
          <Text style={styles.loadingText}>{t('common.searching')}</Text>
        </View>
      ) : queryError ? (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={56} color={colors.error} />
          <Text style={styles.emptyTitle}>{t('explore.load_error')}</Text>
          <Text style={styles.emptySubtitle}>
            {queryError instanceof Error ? queryError.message : t('common.error')}
          </Text>
          <TouchableOpacity style={styles.resetButton} onPress={() => refetch()}>
            <Text style={styles.resetText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={filteredSalons}
          keyExtractor={(item) => item.id}
          initialNumToRender={5}
          windowSize={5}
          maxToRenderPerBatch={10}
          removeClippedSubviews={true}
          renderItem={({ item }) => (
            <SalonCard
              salon={item}
              onPress={handleSalonPress}
              selected={item.id === selectedSalonId}
            />
          )}
          contentContainerStyle={styles.resultsList}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isLoading}
          keyboardDismissMode="on-drag"
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={56} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>{t('explore.no_results')}</Text>
              <Text style={styles.emptySubtitle}>
                {debouncedQuery
                  ? t('explore.no_results_for_query')
                  : selectedWilaya !== 'Toutes'
                  ? t('explore.no_salon_in_wilaya')
                  : t('explore.try_other_filters')}
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
                  <Text style={styles.resetText}>{t('explore.reset_filters')}</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
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
