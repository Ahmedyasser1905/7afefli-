// apps/mobile/src/screens/client/FavoritesScreen.tsx
// M3 — Favorited salons list for the authenticated client

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { apiClient } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing, radius } from '../../theme';
import Ionicons from '@react-native-vector-icons/ionicons';

interface FavoriteItem {
  id: string;
  salon_id: string;
  created_at: string;
  salon: {
    id: string;
    name: string;
    wilaya: string;
    address: string;
    image_url: string | null;
    average_rating: number | null;
    total_reviews: number | null;
    is_approved: boolean;
  } | null;
}

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=400&q=80';

export function FavoritesScreen() {
  const user = useAuthStore((s) => s.user);
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();

  const { data: favorites = [], isLoading, refetch } = useQuery<FavoriteItem[]>({
    queryKey: ['favorites', user?.id],
    queryFn: () => apiClient.get<FavoriteItem[]>('/salons/favorites'),
    enabled: !!user,
    staleTime: 60_000,
  });

  const removeMutation = useMutation({
    mutationFn: (salonId: string) => apiClient.delete(`/salons/${salonId}/favorite`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites', user?.id] });
    },
  });

  const renderItem = ({ item }: { item: FavoriteItem }) => {
    const s = item.salon;
    if (!s) return null;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('SalonDetail', { salonId: s.id })}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: s.image_url || DEFAULT_COVER }}
          style={styles.cover}
          resizeMode="cover"
        />
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.location} numberOfLines={1}>
              {s.address || s.wilaya}
            </Text>
          </View>
          {s.average_rating !== null && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={13} color={colors.amber} />
              <Text style={styles.ratingText}>
                {s.average_rating.toFixed(1)} ({s.total_reviews || 0} avis)
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => removeMutation.mutate(s.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="heart" size={22} color={colors.error} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes Favoris</Text>
        <Text style={styles.subtitle}>Salons que vous avez aimés</Text>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.amber} size="large" />
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isLoading}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="heart-outline" size={56} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Aucun favori</Text>
              <Text style={styles.emptySubtitle}>
                Appuyez sur le cœur d'un salon pour l'ajouter à vos favoris.
              </Text>
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
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    fontFamily: 'Syne_700Bold',
    fontSize: 26,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    gap: spacing.md,
  },
  cover: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    backgroundColor: colors.graphite,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontFamily: 'Syne_600SemiBold',
    fontSize: 15,
    color: colors.textPrimary,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  location: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
  },
  removeBtn: {
    padding: spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontFamily: 'Syne_600SemiBold',
    fontSize: 18,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
