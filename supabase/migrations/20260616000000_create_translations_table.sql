-- Create translations table for dynamic i18n (FR + AR)
CREATE TABLE IF NOT EXISTS public.translations (
  id         uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  key        text    NOT NULL,
  locale     text    NOT NULL CHECK (locale IN ('fr', 'ar')),
  value      text    NOT NULL,
  category   text    NOT NULL DEFAULT 'general',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(key, locale)
);

CREATE INDEX IF NOT EXISTS idx_translations_locale   ON public.translations(locale);
CREATE INDEX IF NOT EXISTS idx_translations_key      ON public.translations(key);
CREATE INDEX IF NOT EXISTS idx_translations_category ON public.translations(category);

ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "translations_public_read" ON public.translations
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "translations_admin_write" ON public.translations
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Admin'));

CREATE OR REPLACE FUNCTION public.update_translations_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS translations_updated_at ON public.translations;
CREATE TRIGGER translations_updated_at
  BEFORE UPDATE ON public.translations
  FOR EACH ROW EXECUTE FUNCTION public.update_translations_updated_at();

-- ── French seed ──────────────────────────────────────────────────────────────
INSERT INTO public.translations (key, locale, category, value) VALUES
  ('nav.home','fr','navigation','Accueil'),
  ('nav.explore','fr','navigation','Explorer'),
  ('nav.favorites','fr','navigation','Favoris'),
  ('nav.appointments','fr','navigation','Mes RDV'),
  ('nav.notifications','fr','navigation','Alertes'),
  ('nav.settings','fr','navigation','Paramètres'),
  ('settings.title','fr','settings','Paramètres'),
  ('settings.role_barber','fr','settings','Coiffeur Professionnel'),
  ('settings.role_client','fr','settings','Client Premium'),
  ('settings.loyalty_section','fr','settings','Programme Fidélité'),
  ('settings.loyalty_points','fr','settings','Points fidélité'),
  ('settings.search_prefs','fr','settings','Préférences de recherche'),
  ('settings.wilaya','fr','settings','Wilaya de recherche'),
  ('settings.system','fr','settings','Réglages Système'),
  ('settings.notifications','fr','settings','Notifications de rappel'),
  ('settings.dark_mode','fr','settings','Thème sombre industriel'),
  ('settings.dark_active','fr','settings','Mode sombre actif'),
  ('settings.light_active','fr','settings','Mode clair actif'),
  ('settings.about','fr','settings','À propos'),
  ('settings.privacy','fr','settings','Politique de confidentialité'),
  ('settings.terms','fr','settings','Conditions d''utilisation'),
  ('settings.version','fr','settings','Version de l''application'),
  ('settings.logout','fr','settings','Se déconnecter'),
  ('settings.delete_account','fr','settings','Supprimer le compte'),
  ('settings.language','fr','settings','Langue'),
  ('settings.language_select','fr','settings','Choisir la langue'),
  ('auth.logout_title','fr','auth','Déconnexion'),
  ('auth.logout_message','fr','auth','Êtes-vous sûr de vouloir vous déconnecter de votre compte ?'),
  ('auth.logout_confirm','fr','auth','Déconnexion'),
  ('auth.cancel','fr','auth','Annuler'),
  ('auth.delete_title','fr','auth','Supprimer le compte'),
  ('auth.delete_message','fr','auth','Cette action est irréversible. Toutes vos données, rendez-vous et historiques seront supprimés définitivement. Voulez-vous continuer ?'),
  ('auth.delete_confirm','fr','auth','Supprimer définitivement'),
  ('home.search_placeholder','fr','home','Rechercher un salon...'),
  ('home.nearby','fr','home','📍 À proximité'),
  ('home.top_rated','fr','home','⭐ 4.5+ Étoiles'),
  ('home.beard','fr','home','🧔 Barbe'),
  ('home.haircut','fr','home','✂️ Coupe'),
  ('home.keratin','fr','home','✨ Kératine'),
  ('home.no_salons','fr','home','Aucun salon trouvé dans votre zone'),
  ('home.location_denied','fr','home','Permission de localisation refusée'),
  ('explore.sort_rating','fr','explore','⭐ Avis'),
  ('explore.sort_distance','fr','explore','📍 Distance'),
  ('explore.sort_price','fr','explore','💰 Prix'),
  ('explore.search_placeholder','fr','explore','Rechercher un salon ou service...'),
  ('explore.wilaya_all','fr','explore','Toutes les wilayas'),
  ('appointments.title','fr','appointments','Mes Rendez-vous'),
  ('appointments.upcoming','fr','appointments','À venir'),
  ('appointments.past','fr','appointments','Passés'),
  ('appointments.empty','fr','appointments','Aucun rendez-vous'),
  ('appointments.book_now','fr','appointments','Réserver maintenant'),
  ('booking.title','fr','booking','Réserver'),
  ('booking.select_service','fr','booking','Choisir un service'),
  ('booking.select_date','fr','booking','Choisir une date'),
  ('booking.select_time','fr','booking','Choisir un horaire'),
  ('booking.confirm','fr','booking','Confirmer la réservation'),
  ('booking.total','fr','booking','Total'),
  ('common.loading','fr','common','Chargement...'),
  ('common.error','fr','common','Erreur'),
  ('common.retry','fr','common','Réessayer'),
  ('common.save','fr','common','Enregistrer'),
  ('common.close','fr','common','Fermer'),
  ('common.search','fr','common','Rechercher'),
  ('common.confirm','fr','common','Confirmer'),
  ('common.back','fr','common','Retour'),
  ('barber.calendar','fr','barber','Calendrier'),
  ('barber.clients','fr','barber','Clients'),
  ('barber.my_salon','fr','barber','Mon Salon'),
  ('barber.subscription','fr','barber','Abonnement'),

-- ── Arabic seed ───────────────────────────────────────────────────────────────
  ('nav.home','ar','navigation','الرئيسية'),
  ('nav.explore','ar','navigation','استكشاف'),
  ('nav.favorites','ar','navigation','المفضلة'),
  ('nav.appointments','ar','navigation','مواعيدي'),
  ('nav.notifications','ar','navigation','التنبيهات'),
  ('nav.settings','ar','navigation','الإعدادات'),
  ('settings.title','ar','settings','الإعدادات'),
  ('settings.role_barber','ar','settings','حلاق محترف'),
  ('settings.role_client','ar','settings','عميل مميز'),
  ('settings.loyalty_section','ar','settings','برنامج الولاء'),
  ('settings.loyalty_points','ar','settings','نقاط الولاء'),
  ('settings.search_prefs','ar','settings','تفضيلات البحث'),
  ('settings.wilaya','ar','settings','ولاية البحث'),
  ('settings.system','ar','settings','إعدادات النظام'),
  ('settings.notifications','ar','settings','إشعارات التذكير'),
  ('settings.dark_mode','ar','settings','الوضع الداكن'),
  ('settings.dark_active','ar','settings','الوضع الداكن مفعّل'),
  ('settings.light_active','ar','settings','الوضع الفاتح مفعّل'),
  ('settings.about','ar','settings','حول التطبيق'),
  ('settings.privacy','ar','settings','سياسة الخصوصية'),
  ('settings.terms','ar','settings','شروط الاستخدام'),
  ('settings.version','ar','settings','إصدار التطبيق'),
  ('settings.logout','ar','settings','تسجيل الخروج'),
  ('settings.delete_account','ar','settings','حذف الحساب'),
  ('settings.language','ar','settings','اللغة'),
  ('settings.language_select','ar','settings','اختر اللغة'),
  ('auth.logout_title','ar','auth','تسجيل الخروج'),
  ('auth.logout_message','ar','auth','هل أنت متأكد أنك تريد تسجيل الخروج من حسابك؟'),
  ('auth.logout_confirm','ar','auth','خروج'),
  ('auth.cancel','ar','auth','إلغاء'),
  ('auth.delete_title','ar','auth','حذف الحساب'),
  ('auth.delete_message','ar','auth','هذا الإجراء لا رجعة فيه. سيتم حذف جميع بياناتك ومواعيدك وسجلاتك نهائياً. هل تريد المتابعة؟'),
  ('auth.delete_confirm','ar','auth','حذف نهائي'),
  ('home.search_placeholder','ar','home','ابحث عن صالون...'),
  ('home.nearby','ar','home','📍 القريبة'),
  ('home.top_rated','ar','home','⭐ 4.5+ نجوم'),
  ('home.beard','ar','home','🧔 لحية'),
  ('home.haircut','ar','home','✂️ قصة شعر'),
  ('home.keratin','ar','home','✨ كيراتين'),
  ('home.no_salons','ar','home','لا توجد صالونات في منطقتك'),
  ('home.location_denied','ar','home','تم رفض إذن الموقع'),
  ('explore.sort_rating','ar','explore','⭐ التقييم'),
  ('explore.sort_distance','ar','explore','📍 المسافة'),
  ('explore.sort_price','ar','explore','💰 السعر'),
  ('explore.search_placeholder','ar','explore','ابحث عن صالون أو خدمة...'),
  ('explore.wilaya_all','ar','explore','جميع الولايات'),
  ('appointments.title','ar','appointments','مواعيدي'),
  ('appointments.upcoming','ar','appointments','القادمة'),
  ('appointments.past','ar','appointments','السابقة'),
  ('appointments.empty','ar','appointments','لا توجد مواعيد'),
  ('appointments.book_now','ar','appointments','احجز الآن'),
  ('booking.title','ar','booking','حجز موعد'),
  ('booking.select_service','ar','booking','اختر خدمة'),
  ('booking.select_date','ar','booking','اختر تاريخاً'),
  ('booking.select_time','ar','booking','اختر وقتاً'),
  ('booking.confirm','ar','booking','تأكيد الحجز'),
  ('booking.total','ar','booking','المجموع'),
  ('common.loading','ar','common','جارٍ التحميل...'),
  ('common.error','ar','common','خطأ'),
  ('common.retry','ar','common','إعادة المحاولة'),
  ('common.save','ar','common','حفظ'),
  ('common.close','ar','common','إغلاق'),
  ('common.search','ar','common','بحث'),
  ('common.confirm','ar','common','تأكيد'),
  ('common.back','ar','common','رجوع'),
  ('barber.calendar','ar','barber','التقويم'),
  ('barber.clients','ar','barber','العملاء'),
  ('barber.my_salon','ar','barber','صالوني'),
  ('barber.subscription','ar','barber','الاشتراك')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
