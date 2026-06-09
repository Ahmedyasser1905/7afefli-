// @ts-nocheck
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

// ─── Wilaya bounding boxes (lat_min, lat_max, lng_min, lng_max) ───────────────
// Ordered by population density so the most-likely match is tested first.
// Coordinates are approximate administrative boundaries.
const WILAYA_BOUNDS: Array<{ name: string; latMin: number; latMax: number; lngMin: number; lngMax: number }> = [
  { name: 'Alger',           latMin: 36.60, latMax: 36.92, lngMin: 2.85,  lngMax: 3.35  },
  { name: 'Oran',            latMin: 35.40, latMax: 35.85, lngMin: -0.75, lngMax: -0.40 },
  { name: 'Constantine',     latMin: 36.25, latMax: 36.50, lngMin: 6.50,  lngMax: 6.75  },
  { name: 'Annaba',          latMin: 36.65, latMax: 36.95, lngMin: 7.65,  lngMax: 7.85  },
  { name: 'Blida',           latMin: 36.35, latMax: 36.65, lngMin: 2.60,  lngMax: 3.05  },
  { name: 'Sétif',           latMin: 35.90, latMax: 36.30, lngMin: 5.20,  lngMax: 5.60  },
  { name: 'Tizi Ouzou',      latMin: 36.55, latMax: 36.95, lngMin: 3.80,  lngMax: 4.35  },
  { name: 'Béjaïa',          latMin: 36.55, latMax: 36.90, lngMin: 4.85,  lngMax: 5.25  },
  { name: 'Batna',           latMin: 35.35, latMax: 35.75, lngMin: 5.85,  lngMax: 6.35  },
  { name: 'Boumerdès',       latMin: 36.65, latMax: 36.92, lngMin: 3.35,  lngMax: 3.85  },
  { name: 'Tipaza',          latMin: 36.45, latMax: 36.75, lngMin: 2.15,  lngMax: 2.85  },
  { name: 'Médéa',           latMin: 35.85, latMax: 36.40, lngMin: 2.55,  lngMax: 3.10  },
  { name: 'Tlemcen',         latMin: 34.55, latMax: 35.15, lngMin: -1.55, lngMax: -1.10 },
  { name: 'Skikda',          latMin: 36.70, latMax: 37.00, lngMin: 6.70,  lngMax: 7.00  },
  { name: 'Guelma',          latMin: 36.25, latMax: 36.60, lngMin: 7.25,  lngMax: 7.65  },
  { name: 'Jijel',           latMin: 36.65, latMax: 37.00, lngMin: 5.40,  lngMax: 5.95  },
  { name: 'Mostaganem',      latMin: 35.70, latMax: 36.10, lngMin: 0.05,  lngMax: 0.45  },
  { name: 'Sidi Bel Abbès',  latMin: 34.95, latMax: 35.30, lngMin: -0.75, lngMax: -0.35 },
  { name: 'Mascara',         latMin: 35.15, latMax: 35.60, lngMin: 0.00,  lngMax: 0.50  },
  { name: 'Tiaret',          latMin: 35.10, latMax: 35.55, lngMin: 1.20,  lngMax: 1.75  },
  { name: 'Chlef',           latMin: 36.00, latMax: 36.40, lngMin: 0.95,  lngMax: 1.50  },
  { name: 'Aïn Defla',       latMin: 36.10, latMax: 36.55, lngMin: 1.60,  lngMax: 2.20  },
  { name: 'Relizane',        latMin: 35.60, latMax: 35.95, lngMin: 0.45,  lngMax: 1.05  },
  { name: 'Mila',            latMin: 36.20, latMax: 36.55, lngMin: 6.15,  lngMax: 6.60  },
  { name: 'Oum El Bouaghi',  latMin: 35.75, latMax: 36.15, lngMin: 6.75,  lngMax: 7.25  },
  { name: 'Khenchela',       latMin: 35.25, latMax: 35.65, lngMin: 6.90,  lngMax: 7.30  },
  { name: 'Tébessa',         latMin: 35.00, latMax: 35.55, lngMin: 7.80,  lngMax: 8.30  },
  { name: 'Souk Ahras',      latMin: 36.10, latMax: 36.55, lngMin: 7.70,  lngMax: 8.15  },
  { name: 'El Tarf',         latMin: 36.55, latMax: 36.90, lngMin: 7.90,  lngMax: 8.45  },
  { name: 'Bordj Bou Arréridj', latMin: 35.90, latMax: 36.25, lngMin: 4.60, lngMax: 5.20 },
  { name: 'Bouira',          latMin: 36.20, latMax: 36.65, lngMin: 3.75,  lngMax: 4.40  },
  { name: 'Aïn Témouchent',  latMin: 35.20, latMax: 35.55, lngMin: -1.30, lngMax: -0.80 },
  { name: 'Naâma',           latMin: 33.10, latMax: 33.70, lngMin: -0.65, lngMax: -0.05 },
  { name: 'El Bayadh',       latMin: 33.25, latMax: 33.85, lngMin: 0.55,  lngMax: 1.30  },
  { name: 'Tissemsilt',      latMin: 35.55, latMax: 35.95, lngMin: 1.60,  lngMax: 2.05  },
  { name: 'Saïda',           latMin: 34.55, latMax: 34.90, lngMin: 0.05,  lngMax: 0.60  },
  { name: 'Laghouat',        latMin: 33.45, latMax: 33.90, lngMin: 2.60,  lngMax: 3.10  },
  { name: 'Djelfa',          latMin: 34.25, latMax: 34.80, lngMin: 3.10,  lngMax: 3.75  },
  { name: 'Ghardaïa',        latMin: 32.15, latMax: 32.60, lngMin: 3.50,  lngMax: 4.00  },
  { name: 'Ouargla',         latMin: 31.75, latMax: 32.20, lngMin: 4.75,  lngMax: 5.25  },
  { name: 'Biskra',          latMin: 34.40, latMax: 34.90, lngMin: 5.45,  lngMax: 5.95  },
  { name: "M'Sila",          latMin: 35.40, latMax: 35.85, lngMin: 4.35,  lngMax: 4.85  },
  { name: 'El Oued',         latMin: 33.15, latMax: 33.65, lngMin: 6.55,  lngMax: 7.05  },
  { name: 'Adrar',           latMin: 27.50, latMax: 28.10, lngMin: -0.35, lngMax: 0.35  },
  { name: 'Tamanrasset',     latMin: 22.50, latMax: 23.00, lngMin: 5.25,  lngMax: 5.75  },
  { name: 'Illizi',          latMin: 26.20, latMax: 26.70, lngMin: 8.30,  lngMax: 8.80  },
  { name: 'Tindouf',         latMin: 27.50, latMax: 28.00, lngMin: -8.20, lngMax: -7.70 },
  { name: 'Béchar',          latMin: 31.40, latMax: 31.85, lngMin: -2.30, lngMax: -1.80 },
  { name: 'Timimoun',        latMin: 29.15, latMax: 29.60, lngMin: 0.15,  lngMax: 0.55  },
  { name: 'Touggourt',       latMin: 32.95, latMax: 33.35, lngMin: 5.80,  lngMax: 6.20  },
  { name: 'Djanet',          latMin: 24.40, latMax: 24.90, lngMin: 9.30,  lngMax: 9.70  },
  { name: 'In Salah',        latMin: 27.00, latMax: 27.40, lngMin: 2.35,  lngMax: 2.75  },
  { name: 'In Guezzam',      latMin: 19.40, latMax: 19.80, lngMin: 5.60,  lngMax: 6.00  },
  { name: 'Bordj Badji Mokhtar', latMin: 21.20, latMax: 21.60, lngMin: 0.70, lngMax: 1.10 },
  { name: 'Ouled Djellal',   latMin: 34.35, latMax: 34.70, lngMin: 4.80,  lngMax: 5.20  },
  { name: 'Béni Abbès',      latMin: 30.00, latMax: 30.40, lngMin: -2.20, lngMax: -1.80 },
  { name: "El M'Ghair",      latMin: 33.60, latMax: 33.95, lngMin: 5.65,  lngMax: 6.05  },
  { name: 'El Meniaa',       latMin: 30.50, latMax: 30.90, lngMin: 2.45,  lngMax: 2.85  },
];

/**
 * Determine a user's wilaya from GPS coordinates using bounding-box lookup.
 * Returns the matched wilaya name, or null if coordinates are outside all boxes
 * (e.g. remote desert, offshore, or outside Algeria).
 */
function getWilayaFromCoords(lat: number, lng: number): string | null {
  for (const w of WILAYA_BOUNDS) {
    if (lat >= w.latMin && lat <= w.latMax && lng >= w.lngMin && lng <= w.lngMax) {
      return w.name;
    }
  }
  return null;
}

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
    let locationSubscription: Location.LocationSubscription | null = null;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError('Permission de localisation refusée');
          setLocation({ latitude: 36.7538, longitude: 3.0588 });
          setUserWilaya('Alger');
          return;
        }

        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 50,  // only fire when user moves 50+ metres
            timeInterval: 30000,   // or every 30 seconds at most
          },
          (loc) => {
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
        setLocationError('Localisation indisponible');
        setLocation({ latitude: 36.7538, longitude: 3.0588 });
        setUserWilaya('Alger');
      }
    })();

    return () => {
      locationSubscription?.remove();
      setSelectedSalonId(null);
    };
  }, []);

  // 2. Fetch salons — pass wilaya once GPS resolves (server-side filter reduces payload)
  const { data: allSalonsResponse, isLoading, refetch } = useQuery({
    queryKey: ['home-salons', userWilaya],
    queryFn: async () => {
      const wilayaParam = userWilaya
        ? `&wilaya=${encodeURIComponent(userWilaya)}`
        : '';
      const data = await apiClient.get<any>(`/salons?limit=100${wilayaParam}`);
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const allSalons = useMemo(() => {
    if (!allSalonsResponse) return [];
    if (Array.isArray(allSalonsResponse)) return allSalonsResponse;
    return allSalonsResponse.data ?? [];
  }, [allSalonsResponse]);

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

  // 4. Sort by proximity — server already narrowed by wilaya
  // Fallback: if server returned empty set (new wilaya with no salons), allSalons could be empty.
  // In that case the query will have already fetched with wilayaParam so no extra filtering needed.
  const salons = useMemo(() => {
    if (!location) return allSalons;
    return [...allSalons].sort((a, b) => {
      if (isPremiumClient && a.is_sponsored !== b.is_sponsored) return a.is_sponsored ? -1 : 1;
      return getDistanceKm(location, a) - getDistanceKm(location, b);
    });
  }, [allSalons, location, isPremiumClient]);

  // 5. Apply UI filters & search on top
  const filteredSalons = useMemo(() => {
    let result = [...salons];

    if (!isPremiumClient) {
      result = result.filter((s) => !s.is_sponsored);
    }

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

    if (activeFilters.has('nearby') && location) {
      result = result.filter((s) => getDistanceKm(location, s) <= 20);
    }

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.wilaya.toLowerCase().includes(q) ||
          (s.address && s.address.toLowerCase().includes(q))
      );
    }

    return result;
  }, [salons, activeFilters, searchQuery, isPremiumClient, location]);

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
