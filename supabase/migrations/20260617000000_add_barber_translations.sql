-- Add barber-role navigation translations (FR + AR)
INSERT INTO public.translations (key, locale, category, value) VALUES
  ('barber.calendar',     'fr', 'barber', 'Calendrier'),
  ('barber.clients',      'fr', 'barber', 'Clients'),
  ('barber.my_salon',     'fr', 'barber', 'Mon Salon'),
  ('barber.subscription', 'fr', 'barber', 'Abonnement'),
  ('barber.calendar',     'ar', 'barber', 'التقويم'),
  ('barber.clients',      'ar', 'barber', 'العملاء'),
  ('barber.my_salon',     'ar', 'barber', 'صالوني'),
  ('barber.subscription', 'ar', 'barber', 'الاشتراك')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
