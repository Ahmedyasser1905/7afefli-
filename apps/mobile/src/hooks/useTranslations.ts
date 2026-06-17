// apps/mobile/src/hooks/useTranslations.ts
// Fetches translations from Supabase for the current locale.
// Returns a t(key) function and metadata (loading, isRTL, locale).
//
// Design decisions:
//  • Translations are fetched once per locale change and cached in React Query.
//  • Falls back to a built-in FR dictionary so the app is never blank offline.
//  • The t() function is memoised so reference equality is stable between renders.

import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useLanguageStore, type AppLocale } from '../store/languageStore';

// ─── Offline fallback ────────────────────────────────────────────────────────
// A minimal subset of French strings so the UI is never empty even without network.
const FR_FALLBACK: Record<string, string> = {
  'nav.home': 'Accueil',
  'nav.explore': 'Explorer',
  'nav.favorites': 'Favoris',
  'nav.appointments': 'Mes RDV',
  'nav.notifications': 'Alertes',
  'nav.settings': 'Paramètres',
  'settings.title': 'Paramètres',
  'settings.role_barber': 'Coiffeur Professionnel',
  'settings.role_client': 'Client Premium',
  'settings.loyalty_section': 'Programme Fidélité',
  'settings.loyalty_points': 'Points fidélité',
  'settings.search_prefs': 'Préférences de recherche',
  'settings.wilaya': 'Wilaya de recherche',
  'settings.system': 'Réglages Système',
  'settings.notifications': 'Notifications de rappel',
  'settings.dark_mode': 'Thème sombre industriel',
  'settings.dark_active': 'Mode sombre actif',
  'settings.light_active': 'Mode clair actif',
  'settings.about': 'À propos',
  'settings.privacy': 'Politique de confidentialité',
  'settings.terms': "Conditions d'utilisation",
  'settings.version': "Version de l'application",
  'settings.logout': 'Se déconnecter',
  'settings.delete_account': 'Supprimer le compte',
  'settings.language': 'Langue',
  'settings.language_select': 'Choisir la langue',
  'auth.logout_title': 'Déconnexion',
  'auth.logout_message': 'Êtes-vous sûr de vouloir vous déconnecter de votre compte ?',
  'auth.logout_confirm': 'Déconnexion',
  'auth.cancel': 'Annuler',
  'auth.delete_title': 'Supprimer le compte',
  'auth.delete_message':
    "Cette action est irréversible. Toutes vos données, rendez-vous et historiques seront supprimés définitivement. Voulez-vous continuer ?",
  'auth.delete_confirm': 'Supprimer définitivement',
  'home.search_placeholder': 'Rechercher un salon...',
  'home.nearby': '📍 À proximité',
  'home.top_rated': '⭐ 4.5+ Étoiles',
  'home.beard': '🧔 Barbe',
  'home.haircut': '✂️ Coupe',
  'home.keratin': '✨ Kératine',
  'home.no_salons': 'Aucun salon trouvé dans votre zone',
  'home.location_denied': 'Permission de localisation refusée',
  'explore.sort_rating': '⭐ Avis',
  'explore.sort_distance': '📍 Distance',
  'explore.sort_price': '💰 Prix',
  'explore.search_placeholder': 'Rechercher un salon ou service...',
  'explore.wilaya_all': 'Toutes les wilayas',
  'appointments.title': 'Mes Rendez-vous',
  'appointments.upcoming': 'À venir',
  'appointments.past': 'Passés',
  'appointments.empty': 'Aucun rendez-vous',
  'appointments.book_now': 'Réserver maintenant',
  'booking.title': 'Réserver',
  'booking.select_service': 'Choisir un service',
  'booking.select_date': 'Choisir une date',
  'booking.select_time': 'Choisir un horaire',
  'booking.confirm': 'Confirmer la réservation',
  'booking.total': 'Total',
  'common.loading': 'Chargement...',
  'common.error': 'Erreur',
  'common.retry': 'Réessayer',
  'common.save': 'Enregistrer',
  'common.close': 'Fermer',
  'common.search': 'Rechercher',
  'common.confirm': 'Confirmer',
  'common.back': 'Retour',
};

const AR_FALLBACK: Record<string, string> = {
  'nav.home': 'الرئيسية',
  'nav.explore': 'استكشاف',
  'nav.favorites': 'المفضلة',
  'nav.appointments': 'مواعيدي',
  'nav.notifications': 'التنبيهات',
  'nav.settings': 'الإعدادات',
  'settings.title': 'الإعدادات',
  'settings.role_barber': 'حلاق محترف',
  'settings.role_client': 'عميل مميز',
  'settings.loyalty_section': 'برنامج الولاء',
  'settings.loyalty_points': 'نقاط الولاء',
  'settings.search_prefs': 'تفضيلات البحث',
  'settings.wilaya': 'ولاية البحث',
  'settings.system': 'إعدادات النظام',
  'settings.notifications': 'إشعارات التذكير',
  'settings.dark_mode': 'الوضع الداكن',
  'settings.dark_active': 'الوضع الداكن مفعّل',
  'settings.light_active': 'الوضع الفاتح مفعّل',
  'settings.about': 'حول التطبيق',
  'settings.privacy': 'سياسة الخصوصية',
  'settings.terms': 'شروط الاستخدام',
  'settings.version': 'إصدار التطبيق',
  'settings.logout': 'تسجيل الخروج',
  'settings.delete_account': 'حذف الحساب',
  'settings.language': 'اللغة',
  'settings.language_select': 'اختر اللغة',
  'auth.logout_title': 'تسجيل الخروج',
  'auth.logout_message': 'هل أنت متأكد أنك تريد تسجيل الخروج من حسابك؟',
  'auth.logout_confirm': 'خروج',
  'auth.cancel': 'إلغاء',
  'auth.delete_title': 'حذف الحساب',
  'auth.delete_message': 'هذا الإجراء لا رجعة فيه. سيتم حذف جميع بياناتك ومواعيدك وسجلاتك نهائياً. هل تريد المتابعة؟',
  'auth.delete_confirm': 'حذف نهائي',
  'home.search_placeholder': 'ابحث عن صالون...',
  'home.nearby': '📍 القريبة',
  'home.top_rated': '⭐ 4.5+ نجوم',
  'home.beard': '🧔 لحية',
  'home.haircut': '✂️ قصة شعر',
  'home.keratin': '✨ كيراتين',
  'home.no_salons': 'لا توجد صالونات في منطقتك',
  'home.location_denied': 'تم رفض إذن الموقع',
  'explore.sort_rating': '⭐ التقييم',
  'explore.sort_distance': '📍 المسافة',
  'explore.sort_price': '💰 السعر',
  'explore.search_placeholder': 'ابحث عن صالون أو خدمة...',
  'explore.wilaya_all': 'جميع الولايات',
  'appointments.title': 'مواعيدي',
  'appointments.upcoming': 'القادمة',
  'appointments.past': 'السابقة',
  'appointments.empty': 'لا توجد مواعيد',
  'appointments.book_now': 'احجز الآن',
  'booking.title': 'حجز موعد',
  'booking.select_service': 'اختر خدمة',
  'booking.select_date': 'اختر تاريخاً',
  'booking.select_time': 'اختر وقتاً',
  'booking.confirm': 'تأكيد الحجز',
  'booking.total': 'المجموع',
  'common.loading': 'جارٍ التحميل...',
  'common.error': 'خطأ',
  'common.retry': 'إعادة المحاولة',
  'common.save': 'حفظ',
  'common.close': 'إغلاق',
  'common.search': 'بحث',
  'common.confirm': 'تأكيد',
  'common.back': 'رجوع',
};

const FALLBACKS: Record<AppLocale, Record<string, string>> = {
  fr: FR_FALLBACK,
  ar: AR_FALLBACK,
};

// ─── Supabase fetch ──────────────────────────────────────────────────────────
async function fetchTranslations(locale: AppLocale): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('translations')
    .select('key, value')
    .eq('locale', locale);

  if (error || !data) {
    // Return fallback silently — network might be unavailable
    return FALLBACKS[locale];
  }

  const map: Record<string, string> = {};
  for (const row of data) {
    map[row.key] = row.value;
  }
  return map;
}

// ─── Public hook ─────────────────────────────────────────────────────────────
export function useTranslations() {
  const { locale, isRTL } = useLanguageStore();

  const { data: translations, isLoading } = useQuery({
    queryKey: ['translations', locale],
    queryFn: () => fetchTranslations(locale),
    // Keep translations cached for 10 minutes — they rarely change
    staleTime: 10 * 60 * 1000,
    // Provide fallback as placeholder data so UI is never blank
    placeholderData: FALLBACKS[locale],
  });

  // Stable t() function — only recreated when locale or translations change
  const t = useCallback(
    (key: string, fallback?: string): string => {
      const dict = translations ?? FALLBACKS[locale];
      return dict[key] ?? fallback ?? key;
    },
    [translations, locale],
  );

  return useMemo(
    () => ({ t, locale, isRTL, isLoading }),
    [t, locale, isRTL, isLoading],
  );
}
