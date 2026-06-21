// apps/mobile/src/components/shared/LegalModal.tsx
// Reusable full-screen modal for Privacy Policy and Terms of Use.
// Content is driven by the current locale (fr | ar) via useTranslations.
// Renders rich sections with icons, headings, and body paragraphs.

import React, { useRef } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Animated,
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTranslations } from '../../hooks/useTranslations';
import { colors, spacing, radius, typography } from '../../theme';

// ─── Types ───────────────────────────────────────────────────────────────────

export type LegalType = 'privacy' | 'terms';

interface LegalSection {
  icon: string;
  title: string;
  body: string;
}

interface LegalModalProps {
  type: LegalType;
  visible: boolean;
  onClose: () => void;
}

// ─── Content definitions ─────────────────────────────────────────────────────

function getPrivacyContent(t: (k: string) => string): { title: string; intro: string; sections: LegalSection[] } {
  return {
    title: t('legal.privacy_title'),
    intro: t('legal.privacy_intro'),
    sections: [
      {
        icon: 'person-outline',
        title: t('legal.privacy_s1_title'),
        body: t('legal.privacy_s1_body'),
      },
      {
        icon: 'analytics-outline',
        title: t('legal.privacy_s2_title'),
        body: t('legal.privacy_s2_body'),
      },
      {
        icon: 'server-outline',
        title: t('legal.privacy_s3_title'),
        body: t('legal.privacy_s3_body'),
      },
      {
        icon: 'share-social-outline',
        title: t('legal.privacy_s4_title'),
        body: t('legal.privacy_s4_body'),
      },
      {
        icon: 'location-outline',
        title: t('legal.privacy_s5_title'),
        body: t('legal.privacy_s5_body'),
      },
      {
        icon: 'shield-checkmark-outline',
        title: t('legal.privacy_s6_title'),
        body: t('legal.privacy_s6_body'),
      },
      {
        icon: 'settings-outline',
        title: t('legal.privacy_s7_title'),
        body: t('legal.privacy_s7_body'),
      },
      {
        icon: 'mail-outline',
        title: t('legal.privacy_s8_title'),
        body: t('legal.privacy_s8_body'),
      },
    ],
  };
}

function getTermsContent(t: (k: string) => string): { title: string; intro: string; sections: LegalSection[] } {
  return {
    title: t('legal.terms_title'),
    intro: t('legal.terms_intro'),
    sections: [
      {
        icon: 'checkmark-circle-outline',
        title: t('legal.terms_s1_title'),
        body: t('legal.terms_s1_body'),
      },
      {
        icon: 'calendar-outline',
        title: t('legal.terms_s2_title'),
        body: t('legal.terms_s2_body'),
      },
      {
        icon: 'close-circle-outline',
        title: t('legal.terms_s3_title'),
        body: t('legal.terms_s3_body'),
      },
      {
        icon: 'storefront-outline',
        title: t('legal.terms_s4_title'),
        body: t('legal.terms_s4_body'),
      },
      {
        icon: 'ban-outline',
        title: t('legal.terms_s5_title'),
        body: t('legal.terms_s5_body'),
      },
      {
        icon: 'card-outline',
        title: t('legal.terms_s6_title'),
        body: t('legal.terms_s6_body'),
      },
      {
        icon: 'alert-circle-outline',
        title: t('legal.terms_s7_title'),
        body: t('legal.terms_s7_body'),
      },
      {
        icon: 'refresh-outline',
        title: t('legal.terms_s8_title'),
        body: t('legal.terms_s8_body'),
      },
      {
        icon: 'mail-outline',
        title: t('legal.terms_s9_title'),
        body: t('legal.terms_s9_body'),
      },
    ],
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LegalModal({ type, visible, onClose }: LegalModalProps) {
  const { t, isRTL } = useTranslations();
  const scrollRef = useRef<ScrollView>(null);

  const content = type === 'privacy' ? getPrivacyContent(t) : getTermsContent(t);
  const textAlign = isRTL ? 'right' : 'left';
  const flexDir = isRTL ? 'row-reverse' : 'row';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.ink} />
      <SafeAreaView style={styles.container}>
        {/* ── Header ── */}
        <View style={[styles.header, { flexDirection: flexDir }]}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { flex: 1, textAlign: 'center' }]}>
            {type === 'privacy' ? t('settings.privacy') : t('settings.terms')}
          </Text>
          {/* Spacer to balance the close button */}
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scroll, { paddingBottom: spacing.xxl * 2 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero Banner ── */}
          <View style={styles.heroBanner}>
            <View style={styles.heroIconCircle}>
              <Ionicons
                name={type === 'privacy' ? 'shield-checkmark' : 'document-text'}
                size={36}
                color={colors.amber}
              />
            </View>
            <Text style={[styles.heroTitle, { textAlign: 'center' }]}>{content.title}</Text>
            <Text style={[styles.heroDate, { textAlign: 'center' }]}>{t('legal.updated')}</Text>
          </View>

          {/* ── Intro ── */}
          <View style={styles.introBox}>
            <Text style={[styles.introText, { textAlign }]}>{content.intro}</Text>
          </View>

          {/* ── Sections ── */}
          {content.sections.map((section, index) => (
            <View key={index} style={styles.sectionCard}>
              <View style={[styles.sectionHeader, { flexDirection: flexDir }]}>
                <View style={styles.sectionIconBadge}>
                  <Ionicons name={section.icon as any} size={18} color={colors.amber} />
                </View>
                <Text style={[styles.sectionTitle, { textAlign, flex: 1, marginLeft: isRTL ? 0 : spacing.sm, marginRight: isRTL ? spacing.sm : 0 }]}>
                  {section.title}
                </Text>
              </View>
              <Text style={[styles.sectionBody, { textAlign }]}>{section.body}</Text>
            </View>
          ))}

          {/* ── Footer stamp ── */}
          <View style={styles.footerStamp}>
            <Ionicons name="business-outline" size={14} color={colors.textMuted} />
            <Text style={styles.footerStampText}>7afefli · Algeria · 2026</Text>
          </View>
        </ScrollView>

        {/* ── Bottom close button ── */}
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.bottomBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.bottomBtnText}>{t('common.close')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
  },

  // Header
  header: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 17,
    color: colors.textPrimary,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  // Scroll
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },

  // Hero
  heroBanner: {
    alignItems: 'center',
    backgroundColor: 'rgba(232,160,32,0.08)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(232,160,32,0.18)',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  heroIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(232,160,32,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: 'rgba(232,160,32,0.3)',
  },
  heroTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 20,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  heroDate: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textMuted,
  },

  // Intro
  introBox: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.amber,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  introText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },

  // Section cards
  sectionCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(232,160,32,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontFamily: 'Syne_600SemiBold',
    fontSize: 15,
    color: colors.textPrimary,
  },
  sectionBody: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 21,
  },

  // Footer stamp
  footerStamp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  footerStampText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: colors.textMuted,
    marginLeft: spacing.xs,
  },

  // Bottom bar
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    backgroundColor: colors.ink,
  },
  bottomBtn: {
    backgroundColor: colors.carbon,
    borderRadius: radius.md,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  bottomBtnText: {
    fontFamily: 'Syne_600SemiBold',
    fontSize: 15,
    color: colors.textPrimary,
  },
});
