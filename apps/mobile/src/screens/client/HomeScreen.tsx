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
  const [locationError, setLocationError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Request location permissions and track location continuously
  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError('Permission de localisation refusée');
          // Fallback coordinates for Algiers Center if user rejects permission
          setLocation({ latitude: 36.7538, longitude: 3.0588 });
          return;
        }
        
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 5, // update every 5 meters
            timeInterval: 5000,  // or every 5 seconds
          },
          (loc) => {
            // Fallback for testing: if location is outside Algeria (roughly), force Algiers
            if (loc.coords.latitude < 15 || loc.coords.latitude > 38 || loc.coords.longitude < -9 || loc.coords.longitude > 12) {
              setLocation({ latitude: 36.7538, longitude: 3.0588 });
              setLocationError('Localisation hors Algérie, position de test (Alger) utilisée');
            } else {
              setLocation({
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
              });
              setLocationError(null);
            }
          }
        );
      } catch {
        setLocationError('Localisation indisponible');
        // Fallback to Algiers
        setLocation({ latitude: 36.7538, longitude: 3.0588 });
      }
    })();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  // Fetch ALL salons once — used for both list (filtered) and map display.
  const { data: allSalons = [], isLoading, refetch } = useQuery<Salon[]>({
    queryKey: ['home-salons-all'],
    queryFn: async () => {
      const data = await apiClient.get<Salon[]>('/salons?limit=100');
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch whether this client has a Premium plan (unlocks sponsored barber visibility)
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

  // Sort by proximity when location is available, else by rating.
  // Sponsored salons bubble to the top only for Premium clients.
  const salons = useMemo(() => {
    if (!location) return allSalons;
    return [...allSalons].sort((a, b) => {
      if (isPremiumClient && a.is_sponsored !== b.is_sponsored) return a.is_sponsored ? -1 : 1;
      const distA = getDistanceKm(location, a);
      const distB = getDistanceKm(location, b);
      return distA - distB;
    });
  }, [allSalons, location, isPremiumClient]);

  const mapSalons = allSalons;

  // Client-side filtering & sorting
  const filteredSalons = useMemo(() => {
    let result = [...salons];

    // Hide sponsored salons from non-Premium clients
    if (!isPremiumClient) {
      result = result.filter((s) => !s.is_sponsored);
    }

    if (activeFilters.has('top_rated')) {
      result = result.filter((s) => s.average_rating >= 4.5);
    }

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        s.wilaya.toLowerCase().includes(q) ||
        (s.address && s.address.toLowerCase().includes(q))
      );
    }

    // Sort: Premium clients see sponsored first, then by rating
    result.sort((a, b) => {
      if (isPremiumClient && a.is_sponsored !== b.is_sponsored) return a.is_sponsored ? -1 : 1;
      return b.average_rating - a.average_rating;
    });

    return result;
  }, [salons, activeFilters, searchQuery, isPremiumClient]);

  const handleToggleFilter = useCallback((filterId: string) => {
    toggleHomeFilter(filterId);
  }, [toggleHomeFilter]);

  const handleSalonPress = useCallback(
    (salon: Salon) => {
      navigation.navigate('SalonDetail', { salonId: salon.id });
    },
    [navigation],
  );

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
        {/* Handle bar for bottom-sheet visual clue */}
        <View style={styles.dragHandleContainer}>
          <View style={styles.dragHandle} />
        </View>

        {/* List Title & Header */}
        <View style={styles.listHeaderRow}>
          <Text style={styles.listTitle}>Salons à proximité</Text>
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
            data={filteredSalons}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <SalonCard salon={item} onPress={handleSalonPress} />
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
                  Essayez d'ajuster vos filtres ou votre recherche.
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
    marginTop: -24, // overlap onto the map
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
  },
  statusBadge: {
    backgroundColor: 'rgba(232, 160, 32, 0.12)',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.full,
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
