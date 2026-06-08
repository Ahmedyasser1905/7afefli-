// @ts-nocheck
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
import { colors, radius, spacing } from '../../theme';
import Ionicons from '@react-native-vector-icons/ionicons';
import { formatTime, formatDZD } from '@barberdz/shared/utils/formatters';

interface ReservationDetailModalProps {
  visible: boolean;
  onClose: () => void;
  reservation: Record<string, unknown> | null;
  onCancel?: (id: string) => void;
  onConfirm?: (id: string) => void;
  onComplete?: (id: string) => void;
}

const DEFAULT_AVATAR =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDqBwevJA_-4C8CiV0jhFk0kQ1wMed3SXsDLtkuYojI_z1NOOr9TsG1ppWseymOF1jEuEUK3KfQn_lUckAbPgmIaSRhgIECSEyCop0h_moZW-TI7--iKZxYbB5dZpkgKIpdJVPPVXhmU_beflYOnLuUI7k4eAbhpYAKJUc2JV4h2TvxiIWmmNqIissEk6ErNlsy-GNvPrX3FNFYIJAjGjQyRcvhURmAzdffu9vrnoRvuq2K4ncxHaDMjasu4zspMlyphP4AOIGdHDxi';

function getStatusColor(status: string): string {
  switch (status) {
    case 'Confirmed': return colors.success;
    case 'Pending': return colors.pending;
    case 'Completed': return '#8B5CF6';
    case 'Cancelled': return colors.error;
    default: return colors.textMuted;
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'Confirmed': return 'Confirmé ✓';
    case 'Pending': return 'En attente…';
    case 'Completed': return 'Terminé';
    case 'Cancelled': return 'Annulé';
    default: return status;
  }
}

export function ReservationDetailModal({
  visible,
  onClose,
  reservation,
  onCancel,
  onConfirm,
  onComplete,
}: ReservationDetailModalProps) {
  if (!reservation) return null;

  const client = reservation.profiles as Record<string, unknown> | undefined;
  const service = reservation.services as Record<string, unknown> | undefined;
  const salonStaff = reservation.salon_staff as Record<string, unknown> | undefined;
  const status = reservation.status as string;
  const id = reservation.id as string;
  const notes = reservation.notes as string | null;

  const isBlock = notes === 'CRÉNEAU BLOQUÉ';
  const isWalkIn = reservation.is_walk_in === true;
  const isPending = status === 'Pending';
  const isCancellable = status !== 'Cancelled' && status !== 'Completed';

  // Parse walk-in client name from notes
  let displayClientName = (client?.full_name as string) || '';
  if (isWalkIn && notes) {
    const match = notes.match(/Client:\s*(.*?)(?:\s*\n|$)/);
    if (match?.[1]) displayClientName = match[1].trim();
  }
  if (!displayClientName?.trim()) {
    displayClientName = (reservation.client_phone as string) || (client?.phone_number as string) || 'Client Inconnu';
  }

  // Parse phone from notes (walk-in) or from profile
  let phoneDisplay = (reservation.client_phone as string) || (client?.phone_number as string) || '';
  if (isWalkIn && notes && !phoneDisplay) {
    const telMatch = notes.match(/Tel:\s*([\d\s+]+)/);
    if (telMatch?.[1]) phoneDisplay = telMatch[1].trim();
  }

  // Staff display name
  const staffName = salonStaff
    ? ((salonStaff.custom_name as string) || ((salonStaff.profiles as Record<string, unknown>)?.full_name as string) || '')
    : '';

  // Format appointment date
  const aptDate = reservation.appointment_date as string;
  const dateLabel = aptDate
    ? new Date(aptDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    : '';

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.content}>
          {/* Handle */}
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>
              {isBlock ? 'Créneau Bloqué' : 'Détails du RDV'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {isBlock ? (
              /* ── Blocked time view ── */
              <View style={styles.blockContainer}>
                <View style={styles.blockIconWrap}>
                  <Ionicons name="lock-closed" size={36} color={colors.amber} />
                </View>
                <Text style={styles.blockTitle}>Créneau Bloqué</Text>
                <Text style={styles.blockTime}>
                  {dateLabel}
                </Text>
                <Text style={styles.blockTime}>
                  {formatTime(reservation.start_time as string)} – {formatTime(reservation.end_time as string)}
                </Text>
              </View>
            ) : (
              <>
                {/* ── Client section ── */}
                <View style={styles.clientSection}>
                  <Image
                    source={{ uri: (client?.avatar_url as string) || DEFAULT_AVATAR }}
                    style={styles.avatar}
                  />
                  <View style={styles.clientInfo}>
                    <Text style={styles.clientName}>{displayClientName}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) + '22', borderColor: getStatusColor(status) + '55' }]}>
                      <View style={[styles.statusDot, { backgroundColor: getStatusColor(status) }]} />
                      <Text style={[styles.statusText, { color: getStatusColor(status) }]}>
                        {getStatusLabel(status)}
                      </Text>
                    </View>
                    {isWalkIn && (
                      <View style={styles.walkInBadge}>
                        <Ionicons name="walk-outline" size={10} color={colors.amber} />
                        <Text style={styles.walkInText}>Sans Rendez-vous</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* ── Details ── */}
                <View style={styles.detailsCard}>
                  {/* Date */}
                  <View style={styles.detailRow}>
                    <View style={styles.detailIconWrap}>
                      <Ionicons name="calendar-outline" size={18} color={colors.amber} />
                    </View>
                    <View style={styles.detailTextCol}>
                      <Text style={styles.detailLabel}>Date</Text>
                      <Text style={styles.detailValue} numberOfLines={1}>{dateLabel || '—'}</Text>
                    </View>
                  </View>

                  <View style={styles.separator} />

                  {/* Heure */}
                  <View style={styles.detailRow}>
                    <View style={styles.detailIconWrap}>
                      <Ionicons name="time-outline" size={18} color={colors.amber} />
                    </View>
                    <View style={styles.detailTextCol}>
                      <Text style={styles.detailLabel}>Horaire</Text>
                      <Text style={styles.detailValue}>
                        {formatTime(reservation.start_time as string)} – {formatTime(reservation.end_time as string)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.separator} />

                  {/* Service */}
                  <View style={styles.detailRow}>
                    <View style={styles.detailIconWrap}>
                      <Ionicons name="cut-outline" size={18} color={colors.amber} />
                    </View>
                    <View style={styles.detailTextCol}>
                      <Text style={styles.detailLabel}>Service</Text>
                      <Text style={styles.detailValue}>
                        {(service?.service_name as string) || 'Non spécifié'}
                        {service?.duration_minutes ? ` • ${service.duration_minutes} min` : ''}
                      </Text>
                    </View>
                  </View>

                  {/* Staff */}
                  {staffName ? (
                    <>
                      <View style={styles.separator} />
                      <View style={styles.detailRow}>
                        <View style={styles.detailIconWrap}>
                          <Ionicons name="person-outline" size={18} color={colors.amber} />
                        </View>
                        <View style={styles.detailTextCol}>
                          <Text style={styles.detailLabel}>Coiffeur</Text>
                          <Text style={styles.detailValue}>{staffName}</Text>
                        </View>
                      </View>
                    </>
                  ) : null}

                  {/* Prix */}
                  {service?.price ? (
                    <>
                      <View style={styles.separator} />
                      <View style={styles.detailRow}>
                        <View style={styles.detailIconWrap}>
                          <Ionicons name="cash-outline" size={18} color={colors.amber} />
                        </View>
                        <View style={styles.detailTextCol}>
                          <Text style={styles.detailLabel}>Prix</Text>
                          <Text style={styles.detailValue}>{formatDZD(service.price as number)}</Text>
                        </View>
                      </View>
                    </>
                  ) : null}

                  {/* Téléphone */}
                  {phoneDisplay ? (
                    <>
                      <View style={styles.separator} />
                      <View style={styles.detailRow}>
                        <View style={styles.detailIconWrap}>
                          <Ionicons name="call-outline" size={18} color={colors.amber} />
                        </View>
                        <View style={styles.detailTextCol}>
                          <Text style={styles.detailLabel}>Téléphone</Text>
                          <Text style={styles.detailValue}>{phoneDisplay}</Text>
                        </View>
                      </View>
                    </>
                  ) : null}

                  {/* Notes */}
                  {notes && !isWalkIn && (
                    <>
                      <View style={styles.separator} />
                      <View style={styles.detailRow}>
                        <View style={styles.detailIconWrap}>
                          <Ionicons name="document-text-outline" size={18} color={colors.amber} />
                        </View>
                        <View style={styles.detailTextCol}>
                          <Text style={styles.detailLabel}>Notes</Text>
                          <Text style={styles.detailValue}>{notes}</Text>
                        </View>
                      </View>
                    </>
                  )}
                </View>

                {/* ── Actions ── */}
                <View style={styles.actionsRow}>
                  {isPending && onConfirm && (
                    <TouchableOpacity
                      style={styles.confirmButton}
                      onPress={() => { onConfirm(id); onClose(); }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="checkmark-circle-outline" size={18} color={colors.ink} />
                      <Text style={styles.confirmButtonText}>Confirmer</Text>
                    </TouchableOpacity>
                  )}

                  {status === 'Confirmed' && onComplete && (
                    <TouchableOpacity
                      style={styles.completeButton}
                      onPress={() => { onComplete(id); onClose(); }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="checkmark-done-outline" size={18} color="#fff" />
                      <Text style={styles.completeButtonText}>Terminé</Text>
                    </TouchableOpacity>
                  )}

                  {isCancellable && onCancel && (
                    <TouchableOpacity
                      style={[styles.cancelButton, (isPending || status === 'Confirmed') && styles.cancelButtonSmall]}
                      onPress={() => { onCancel(id); onClose(); }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="close-circle-outline" size={18} color={colors.error} />
                      <Text style={styles.cancelButtonText}>Annuler</Text>
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
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: colors.ink,
    borderTopLeftRadius: radius.xxl ?? 28,
    borderTopRightRadius: radius.xxl ?? 28,
    maxHeight: '88%',
    paddingBottom: spacing.xxl,
  },
  handle: {
    width: 36, height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  title: {
    fontFamily: 'Syne_700Bold',
    fontSize: 18,
    color: colors.textPrimary,
  },
  closeBtn: { padding: 6 },
  scrollArea: { padding: spacing.xl },

  // Client section
  clientSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  avatar: {
    width: 60, height: 60,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.amber,
  },
  clientInfo: { flex: 1, gap: 6 },
  clientName: {
    fontFamily: 'Syne_700Bold',
    fontSize: 18,
    color: colors.textPrimary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: 'DMSans_500Medium', fontSize: 12 },
  walkInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,193,7,0.1)',
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  walkInText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    color: colors.amber,
  },

  // Details card
  detailsCard: {
    backgroundColor: colors.carbon,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: spacing.xl,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  detailIconWrap: {
    width: 32, height: 32,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,193,7,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTextCol: { flex: 1 },
  detailLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginVertical: 2,
  },

  // Block style
  blockContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  blockIconWrap: {
    width: 72, height: 72,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,193,7,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 22,
    color: colors.textPrimary,
  },
  blockTime: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.success,
    borderRadius: radius.md,
    padding: spacing.md,
    height: 50,
  },
  confirmButtonText: {
    fontFamily: 'Syne_700Bold',
    fontSize: 15,
    color: colors.ink,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: radius.md,
    padding: spacing.md,
    height: 50,
  },
  cancelButtonSmall: {
    flex: 0.5,
  },
  cancelButtonText: {
    fontFamily: 'Syne_700Bold',
    fontSize: 15,
    color: colors.error,
  },
  completeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#8B5CF6',
    borderRadius: radius.md,
    padding: spacing.md,
    height: 50,
  },
  completeButtonText: {
    fontFamily: 'Syne_700Bold',
    fontSize: 15,
    color: '#fff',
  },
});
