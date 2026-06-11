// apps/mobile/src/screens/client/LoyaltyPointsScreen.tsx
// Loyalty points history screen — shows total and transaction list

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing, radius } from '../../theme';
import Ionicons from '@react-native-vector-icons/ionicons';

interface LoyaltyTransaction {
  id: string;
  date: string;
  reason: string;
  points: number;
}

interface LoyaltyData {
  total: number;
  transactions: LoyaltyTransaction[];
}

export function LoyaltyPointsScreen() {
  const navigation = useNavigation();
  const { session } = useAuthStore();

  const { data, isLoading, refetch, isRefetching } = useQuery<LoyaltyData>({
    queryKey: ['loyalty-points'],
    queryFn: () => apiClient.get<LoyaltyData>('/auth/profiles/me/loyalty'),
    enabled: !!session,
    staleTime: 2 * 60 * 1000,
  });

  const total = data?.total ?? 0;
  const transactions = data?.transactions ?? [];

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Points Fidélité</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Points Balance Hero Card */}
      <View style={styles.balanceCard}>
        <Ionicons name="trophy" size={40} color={colors.amber} />
        <Text style={styles.balanceLabel}>Solde actuel</Text>
        <Text style={styles.balancePoints}>{total}</Text>
        <Text style={styles.balancePts}>points</Text>
        <Text style={styles.balanceHint}>
          Gagnez 10 points pour chaque rendez-vous complété
        </Text>
      </View>

      {/* Transaction History */}
      <Text style={styles.sectionTitle}>Historique des transactions</Text>

      {isLoading ? (
        <ActivityIndicator color={colors.amber} size="large" style={{ marginTop: 40 }} />
      ) : transactions.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="receipt-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Aucune transaction</Text>
          <Text style={styles.emptySubtitle}>
            Complétez vos premiers rendez-vous pour commencer à gagner des points.
          </Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onRefresh={refetch}
          refreshing={isRefetching}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.transactionCard}>
              <View style={styles.transactionIcon}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              </View>
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionReason} numberOfLines={1}>
                  {item.reason}
                </Text>
                <Text style={styles.transactionDate}>{formatDate(item.date)}</Text>
              </View>
              <View style={styles.transactionPointsWrap}>
                <Text style={styles.transactionPoints}>+{item.points}</Text>
                <Text style={styles.transactionPts}>pts</Text>
              </View>
            </View>
          )}
          ListFooterComponent={<View style={{ height: 60 }} />}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.carbon,
  },
  headerTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 18,
    color: colors.textPrimary,
  },
  balanceCard: {
    alignItems: 'center',
    backgroundColor: colors.carbon,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(232, 160, 32, 0.2)',
    gap: spacing.xs,
  },
  balanceLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  balancePoints: {
    fontFamily: 'Syne_700Bold',
    fontSize: 56,
    color: colors.amber,
    lineHeight: 64,
  },
  balancePts: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: colors.amber,
    opacity: 0.7,
  },
  balanceHint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  sectionTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 14,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingLeft: 4,
  },
  list: {
    paddingHorizontal: spacing.lg,
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.carbon,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: spacing.md,
  },
  transactionIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: 'rgba(46, 204, 113, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionInfo: {
    flex: 1,
  },
  transactionReason: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: colors.textPrimary,
  },
  transactionDate: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  transactionPointsWrap: {
    alignItems: 'flex-end',
  },
  transactionPoints: {
    fontFamily: 'Syne_700Bold',
    fontSize: 18,
    color: colors.success,
  },
  transactionPts: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 10,
    color: colors.textMuted,
  },
  emptyWrap: {
    alignItems: 'center',
    marginTop: 60,
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 18,
    color: colors.textPrimary,
  },
  emptySubtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
