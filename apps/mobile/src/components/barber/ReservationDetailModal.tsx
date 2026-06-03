// apps/mobile/src/components/barber/ReservationDetailModal.tsx
import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';
import Ionicons from "@react-native-vector-icons/ionicons";
import { formatTime, formatDZD } from '@barberdz/shared/utils/formatters';

interface ReservationDetailModalProps {
  visible: boolean;
  onClose: () => void;
  reservation: Record<string, unknown>;
  onCancel?: (id: string) => void;
}

const DEFAULT_AVATAR = 'https://lh3.googleusercontent.com/aida-public/AB6AXuDqBwevJA_-4C8CiV0jhFk0kQ1wMed3SXsDLtkuYojI_z1NOOr9TsG1ppWseymOF1jEuEUK3KfQn_lUckAbPgmIaSRhgIECSEyCop0h_moZW-TI7--iKZxYbB5dZpkgKIpdJVPPVXhmU_beflYOnLuUI7k4eAbhpYAKJUc2JV4h2TvxiIWmmNqIissEk6ErNlsy-GNvPrX3FNFYIJAjGjQyRcvhURmAzdffu9vrnoRvuq2K4ncxHaDMjasu4zspMlyphP4AOIGdHDxi';

export function ReservationDetailModal({ visible, onClose, reservation, onCancel }: ReservationDetailModalProps) {
  if (!reservation) return null;

  const client = reservation.profiles;
  const service = reservation.services;
  const isBlock = reservation.notes === 'CRÉNEAU BLOQUÉ';

  const isWalkIn = reservation.notes?.includes('[Sans RDV]');
  let displayClientName = client?.full_name;
  if (isWalkIn && reservation.notes) {
    const match = reservation.notes.match(/Client:\s*(.*?)(?:\s*-\s*Tel:|\s*\n|$)/);
    if (match && match[1]) {
      displayClientName = match[1].trim();
    }
  }
  if (!displayClientName || displayClientName.trim() === '') {
    displayClientName = reservation.client_phone || client?.phone_number || 'Client Inconnu';
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Détails du Rendez-vous</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea}>
            {isBlock ? (
              <View style={styles.blockContainer}>
                <Ionicons name="calendar" size={48} color={colors.amber} />
                <Text style={styles.blockTitle}>Créneau Bloqué</Text>
                <Text style={styles.blockTime}>
                  {formatTime(reservation.start_time)} – {formatTime(reservation.end_time)}
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.clientSection}>
                  <Image source={{ uri: client?.avatar_url || DEFAULT_AVATAR }} style={styles.avatar} />
                  <View>
                    <Text style={styles.clientName}>{displayClientName}</Text>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>{reservation.status}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.detailsList}>
                  <View style={styles.detailRow}>
                    <Ionicons name="cut-outline" size={20} color={colors.amber} />
                    <View style={styles.detailTextCol}>
                      <Text style={styles.detailLabel}>Service & Coiffeur</Text>
                      <Text style={styles.detailValue}>
                        {service?.service_name || 'Non spécifié'} • {reservation.salon_staff ? (reservation.salon_staff.custom_name || reservation.salon_staff.profiles?.full_name) : 'N\'importe quel coiffeur'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailRow}>
                    <Ionicons name="time-outline" size={20} color={colors.amber} />
                    <View style={styles.detailTextCol}>
                      <Text style={styles.detailLabel}>Horaire</Text>
                      <Text style={styles.detailValue}>
                        {formatTime(reservation.start_time)} – {formatTime(reservation.end_time)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailRow}>
                    <Ionicons name="cash-outline" size={20} color={colors.amber} />
                    <View style={styles.detailTextCol}>
                      <Text style={styles.detailLabel}>Prix estimé</Text>
                      <Text style={styles.detailValue}>
                        {service?.price ? formatDZD(service.price) : '0 DZD'}
                      </Text>
                    </View>
                  </View>

                  {(reservation.client_phone || client?.phone_number) && (
                    <View style={styles.detailRow}>
                      <Ionicons name="call-outline" size={20} color={colors.amber} />
                      <View style={styles.detailTextCol}>
                        <Text style={styles.detailLabel}>Téléphone</Text>
                        <Text style={styles.detailValue}>{reservation.client_phone || client?.phone_number}</Text>
                      </View>
                    </View>
                  )}

                  {reservation.notes && (
                    <View style={styles.detailRow}>
                      <Ionicons name="document-text-outline" size={20} color={colors.amber} />
                      <View style={styles.detailTextCol}>
                        <Text style={styles.detailLabel}>Notes</Text>
                        <Text style={styles.detailValue}>{reservation.notes}</Text>
                      </View>
                    </View>
                  )}

                  {reservation.status !== 'Cancelled' && reservation.status !== 'Completed' && onCancel && (
                    <TouchableOpacity 
                      style={styles.cancelButton}
                      onPress={() => {
                        onCancel(reservation.id);
                        onClose();
                      }}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.error} />
                      <Text style={styles.cancelButtonText}>Annuler cette réservation</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: colors.ink,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '80%',
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  title: {
    fontFamily: 'Syne_700Bold',
    fontSize: 20,
    color: colors.textPrimary,
  },
  closeBtn: {
    padding: spacing.sm,
  },
  scrollArea: {
    padding: spacing.xl,
  },
  clientSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    marginRight: spacing.md,
    borderWidth: 2,
    borderColor: colors.amber,
  },
  clientName: {
    fontFamily: 'Syne_700Bold',
    fontSize: 20,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  statusBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    color: colors.textPrimary,
  },
  detailsList: {
    gap: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  detailTextCol: {
    flex: 1,
  },
  detailLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 2,
  },
  detailValue: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
    color: colors.textPrimary,
  },
  blockContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  blockTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 24,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  blockTime: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  cancelButtonText: {
    fontFamily: 'Syne_700Bold',
    fontSize: 15,
    color: colors.error,
  },
});
