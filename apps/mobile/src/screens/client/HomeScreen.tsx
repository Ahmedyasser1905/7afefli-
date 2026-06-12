import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, radius, shadows } from '../../theme';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient';
import { SalonCard } from '../../components/salon/SalonCard';
import { SalonMapView } from '../../components/map/SalonMapView';
import Ionicons from "@react-native-vector-icons/ionicons";
import type { Salon } from '@barberdz/shared/types';
import { useMapPreferences } from '../../store/mapPreferencesStore';
import { NotificationBell } from '../../components/shared/NotificationBell';

import { WILAYA_BOUNDS, getWilayaFromCoords } from '@barberdz/shared/constants/wilayas';

function getDistanceKm(
  user: { latitude: number; longitude: number },
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

const FILTER_OPTIONS = [
  { id: 'nearby', label: '📍 À proximité' },
  { id: 'top_rated', label: '⭐ 4.5+ Étoiles' },
  { id: 'beard', label: '🧔 Barbe' },
  { id: 'haircut', label: '✂️ Coupe' },
  { id: 'keratin', label: '✨ Kératine' },
];

interface Coords {
  latitude: number;
  longitude: number;
}

export function HomeScreen() {
  const navigation = useNavigation<Record<string, unknown>>();
  const { activeHomeFilters, toggleHomeFilter } = useMapPreferences();
  const activeFilters = new Set(activeHomeFilters);
  const [location, setLocation] = useState<Coords | null>(null);
  const [userWilaya, setUserWilaya] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSalonId, setSelectedSalonId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Throttle: only update location state when coords change meaningfully (>50m)
  const lastLocationRef = useRef<Coords | null>(null);

  // 1. Request location permissions and track location
  useEffect(() => {
    // Fix M8: store subscription outside the async IIFE so cleanup always has access
    // even if the component unmounts before watchPositionAsync resolves.
    const subscriptionRef: { current: Location.LocationSubscription | null } = { current: null };
    let isMounted = true;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!isMounted) return; // component unmounted while awaiting permission

        if (status !== 'granted') {
          setLocationError('Permission de localisation refusée');
          setLocation({ latitude: 36.7538, longitude: 3.0588 });
          setUserWilaya('Alger');
          return;
        }

        subscriptionRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 50,  // only fire when user moves 50+ metres
            timeInterval: 30000,   // or every 30 seconds at most
          },
          (loc) => {
            if (!isMounted) return; // component unmounted between updates
            const { latitude, longitude } = loc.coords;

            // Guard: outside Algeria bounding box → fall back to Algiers
            if (latitude < 15 || latitude > 38 || longitude < -9 || longitude > 12) {
              if (!lastLocationRef.current) {
                setLocation({ latitude: 36.7538, longitude: 3.0588 });
                setUserWilaya('Alger');
                setLocationError('Localisation hors Algérie, position de test (Alger) utilisée');
              }
              return;
            }

            const prev = lastLocationRef.current;
            // Skip state update if coords haven't meaningfully changed
            if (
              prev &&
              Math.abs(prev.latitude - latitude) < 0.00045 &&   // ~50m
              Math.abs(prev.longitude - longitude) < 0.00045
            ) {
              return;
            }

            const newCoords = { latitude, longitude };
            lastLocationRef.current = newCoords;
            setLocation(newCoords);
            setLocationError(null);

            // Detect wilaya from coordinates
            const wilaya = getWilayaFromCoords(latitude, longitude);
            setUserWilaya(wilaya);
          }
        );
      } catch {
        if (!isMounted) return;
        setLocationError('Localisation indisponible');
        setLocation({ latitude: 36.7538, longitude: 3.0588 });
        setUserWilaya('Alger');
      }
    })();

    return () => {
      isMounted = false;
      subscriptionRef.current?.remove(); // always runs, even if IIFE is still pending
      setSelectedSalonId(null);
    };
  }, []);

  // 2. Fetch salons:
  //    - When GPS coords are available → use /salons/nearby (PostGIS, 50 km radius)
  //    - When GPS is pending/denied    → fall back to /salons?wilaya=X (wilaya-text filter)
  const hasLocation = location !== null;

  const { data: nearbyResponse, isLoading: nearbyLoading, refetch: refetchNearby } = useQuery({
    queryKey: ['home-salons-nearby', location?.latitude, location?.longitude],
    queryFn: async () => {
      if (!location) return null;
      const data = await apiClient.get<any>(
        `/salons/nearby?lat=${location.latitude}&lng=${location.longitude}&radius=50&limit=100`
      );
      return data;
    },
    enabled: hasLocation,
    staleTime: 2 * 60 * 1000, // 2 min — re-fetched when location changes meaningfully
  });

  const { data: wilayaResponse, isLoading: wilayaLoading, refetch: refetchWilaya } = useQuery({
    queryKey: ['home-salons-wilaya', userWilaya],
    queryFn: async () => {
      const wilayaParam = userWilaya ? `&wilaya=${encodeURIComponent(userWilaya)}` : '';
      const data = await apiClient.get<any>(`/salons?limit=100${wilayaParam}`);
      return data;
    },
    // Only fetch wilaya list as a fallback when GPS nearby returns 0 results or GPS unavailable
    enabled: !hasLocation || (nearbyResponse !== null && Array.isArray(nearbyResponse) ? nearbyResponse.length === 0 : (nearbyResponse as any)?.data?.length === 0),
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = nearbyLoading || wilayaLoading;

  const refetch = useCallback(() => {
    refetchNearby();
    refetchWilaya();
  }, [refetchNearby, refetchWilaya]);

  // Normalise the raw API responses into a flat array
  const allSalons = useMemo(() => {
    // Helper: map distance_meters → distance_km (SalonCard expects distance_km)
    const addDistanceKm = (salons: any[]) =>
      salons.map((s) =>
        s.distance_meters !== undefined && s.distance_km === undefined
          ? { ...s, distance_km: s.distance_meters / 1000 }
          : s
      );

    // Prefer GPS-based nearby results
    if (hasLocation && nearbyResponse) {
      const raw = Array.isArray(nearbyResponse) ? nearbyResponse : ((nearbyResponse as any).data ?? []);
      return addDistanceKm(raw);
    }
    // Fall back to wilaya text-filter results
    if (wilayaResponse) {
      const raw = Array.isArray(wilayaResponse) ? wilayaResponse : ((wilayaResponse as any).data ?? []);
      return raw; // no distance available from wilaya endpoint
    }
    return [];
  }, [hasLocation, nearbyResponse, wilayaResponse]);

  // 3. Client Premium plan
  const { data: clientPlan } = useQuery<{ plan: string; isPremium: boolean }>({
    queryKey: ['client-plan'],
    queryFn: async () => {
      try {
        return await apiClient.get<{ plan: string; isPremium: boolean }>('/subscriptions/my-client-plan');
      } catch {
        return { plan: 'Free', isPremium: false };
      }
    },
    staleTime: 10 * 60 * 1000,
  });

  const isPremiumClient = clientPlan?.isPremium ?? false;

  // 4. Sort and filter by proximity (strict 50km limit)
  //    - If nearby RPC was used, results already come sorted and filtered by distance_meters ASC.
  //    - If wilaya fallback is used (because GPS was off), sort client-side by Haversine distance.
  const salons = useMemo(() => {
    if (!allSalons.length) return [];

    // Check if results already have distance_meters (from /nearby RPC)
    const hasServerDistance = allSalons[0]?.distance_meters !== undefined;

    if (hasServerDistance) {
      // The backend RPC already filtered these to 50km. Just sort them.
      let filtered = allSalons;
      
      // Secondary safety check: ensure strictly <= 50km
      filtered = filtered.filter(a => (a.distance_meters ?? 0) <= 50000);

      return [...filtered].sort((a, b) => {
        const priceA = a.plan_price ?? 0;
        const priceB = b.plan_price ?? 0;
        if (priceA !== priceB) return priceB - priceA;
        return (a.distance_meters ?? 0) - (b.distance_meters ?? 0);
      });
    }

    // Wilaya fallback — filter and sort client-side if we have GPS coords
    if (!location) return allSalons;

    // Strict 50km limit if location is known
    const withinRadius = allSalons.filter(salon => getDistanceKm(location, salon) <= 50);

    return [...withinRadius].sort((a, b) => {
      const priceA = a.plan_price ?? 0;
      const priceB = b.plan_price ?? 0;
      if (priceA !== priceB) return priceB - priceA;
      return getDistanceKm(location, a) - getDistanceKm(location, b);
    });
  }, [allSalons, location, isPremiumClient]);

  // 5. Apply UI filters & search on top
  const filteredSalons = useMemo(() => {
    let result = [...salons];

    if (activeFilters.has('top_rated')) {
      result = result.filter((s) => s.average_rating >= 4.5);
    }

    if (activeFilters.has('beard')) {
      result = result.filter((s) =>
        s.services?.some((srv) => {
          const name = srv.service_name.toLowerCase();
          return name.includes('barbe') || name.includes('beard') || name.includes('rasage');
        })
      );
    }

    if (activeFilters.has('haircut')) {
      result = result.filter((s) =>
        s.services?.some((srv) => {
          const name = srv.service_name.toLowerCase();
          return name.includes('coupe') || name.includes('hair') || name.includes('cheveux') || name.includes('coiffure');
        })
      );
    }

    if (activeFilters.has('keratin')) {
      result = result.filter((s) =>
        s.services?.some((srv) => {
          const name = srv.service_name.toLowerCase();
          return name.includes('kératine') || name.includes('keratin') || name.includes('lissage');
        })
      );
    }

    // "nearby" filter pill: ≤50 km
    // Use server distance_meters if available; otherwise Haversine client-side
    if (activeFilters.has('nearby') && (hasLocation || location)) {
      const NEARBY_KM = 50;
      result = result.filter((s) => {
        if (s.distance_meters !== undefined) return s.distance_meters <= NEARBY_KM * 1000;
        if (location && s.latitude && s.longitude) return getDistanceKm(location, s) <= NEARBY_KM;
        return true; // no coords available — include by default
      });
    }

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          (s.name && s.name.toLowerCase().includes(q)) ||
          (s.wilaya && s.wilaya.toLowerCase().includes(q)) ||
          (s.address && s.address.toLowerCase().includes(q))
      );
    }

    return result;
  }, [salons, activeFilters, searchQuery, isPremiumClient, location]);

  // Reset selected salon when the filtered list changes so the map popup
  // never lingers for a salon that has been filtered out
  useEffect(() => {
    setSelectedSalonId(prev => {
      if (prev && !filteredSalons.some(s => s.id === prev)) return null;
      return prev;
    });
  }, [filteredSalons]);

  // Map shows the same filtered salons
  const mapSalons = filteredSalons;

  const handleToggleFilter = useCallback((filterId: string) => {
    toggleHomeFilter(filterId);
  }, [toggleHomeFilter]);

  const handleSalonPress = useCallback(
    (salon: Salon) => {
      if (selectedSalonId === salon.id) {
        navigation.navigate('SalonDetail', { salonId: salon.id });
      } else {
        setSelectedSalonId(salon.id);
      }
    },
    [selectedSalonId, navigation],
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

  const listTitle = userWilaya
    ? `Salons à ${userWilaya}`
    : 'Salons à proximité';

  return (
    <SafeAreaView style={styles.container}>
      {/* Floating Top Header & Search Bar */}
      <View style={styles.floatingHeader}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, paddingHorizontal: spacing.sm }}>
          <Text style={{ fontFamily: 'Syne_700Bold', fontSize: 24, color: colors.amber }}>7afefli</Text>
          <NotificationBell />
        </View>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher salons, wilayas..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          <TouchableOpacity
            style={styles.tuneButton}
            activeOpacity={0.7}
            onPress={() => navigation.getParent()?.navigate('Explore')}
          >
            <Ionicons name="options-outline" size={18} color={colors.amber} />
          </TouchableOpacity>
        </View>

        {/* Categories / Filter Pills */}
        <View style={styles.filterWrapper}>
          <FlatList
            horizontal
            data={FILTER_OPTIONS}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContainer}
            renderItem={({ item }) => {
              const isActive = activeFilters.has(item.id);
              return (
                <TouchableOpacity
                  style={[styles.filterPill, isActive && styles.filterPillActive]}
                  onPress={() => handleToggleFilter(item.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>

      {/* Interactive Map */}
      <View style={styles.mapContainer}>
        <SalonMapView
          salons={mapSalons}
          userLocation={location}
          onSalonPress={(salonId) => navigation.navigate('SalonDetail', { salonId })}
          onMarkerClick={handleMarkerClick}
          onPopupClose={() => setSelectedSalonId(null)}
          selectedSalonId={selectedSalonId}
          height={220}
        />

        {locationError && (
          <View style={styles.locationErrorCard}>
            <Ionicons name="navigate-outline" size={16} color={colors.error} />
            <Text style={styles.locationErrorText}>{locationError}</Text>
          </View>
        )}
      </View>

      {/* Nearby Salons List (Bottom Sheet Style) */}
      <View style={styles.bottomSheetContainer}>
        <View style={styles.dragHandleContainer}>
          <View style={styles.dragHandle} />
        </View>

        <View style={styles.listHeaderRow}>
          <Text style={styles.listTitle}>{listTitle}</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>
              {isLoading ? 'Recherche...' : `${filteredSalons.length} dispos`}
            </Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.amber} size="large" style={{ marginTop: 20 }} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={filteredSalons}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <SalonCard
                salon={item}
                onPress={handleSalonPress}
                selected={item.id === selectedSalonId}
              />
            )}
            contentContainerStyle={styles.salonListContent}
            showsVerticalScrollIndicator={false}
            onRefresh={refetch}
            refreshing={isLoading}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="business" size={48} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>Aucun salon trouvé</Text>
                <Text style={styles.emptySubtitle}>
                  {userWilaya
                    ? `Pas encore de salon enregistré à ${userWilaya}.`
                    : "Essayez d'ajuster vos filtres ou votre recherche."}
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  floatingHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.ink,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    height: 54,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
  },
  tuneButton: {
    backgroundColor: 'rgba(232, 160, 32, 0.12)',
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterWrapper: {
    marginTop: spacing.sm,
  },
  filterContainer: {
    gap: spacing.sm,
    paddingBottom: 4,
  },
  filterPill: {
    backgroundColor: colors.carbon,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  filterPillActive: {
    backgroundColor: 'rgba(232, 160, 32, 0.15)',
    borderColor: colors.amber,
  },
  filterText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.amber,
  },
  mapContainer: {
    height: 220,
    position: 'relative',
    backgroundColor: colors.graphite,
    overflow: 'hidden',
  },
  locationErrorCard: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(62, 28, 26, 0.9)',
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  locationErrorText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: '#FF8A80',
  },
  bottomSheetContainer: {
    flex: 1,
    backgroundColor: colors.ink,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginTop: -24,
    paddingTop: spacing.sm,
  },
  dragHandleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.graphite,
    borderRadius: 2,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  listTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 20,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  statusBadge: {
    backgroundColor: 'rgba(232, 160, 32, 0.12)',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.full,
    marginLeft: spacing.sm,
  },
  statusBadgeText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 11,
    color: colors.amber,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  salonListContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    fontFamily: 'Syne_600SemiBold',
    fontSize: 16,
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
});
