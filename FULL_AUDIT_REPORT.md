# FULL_AUDIT_REPORT.md
# Rapport d'Audit Complet — Projet 7afefli / BarberDZ / Hafefli
**Date d'audit :** 10 juin 2026  
**Repository :** https://github.com/Ahmedyasser1905/7afefli-.git  
**Mode :** READ ONLY — Aucun fichier modifié  
**Fichiers scannés :** 204 fichiers (TS/TSX/SQL/JSON)  

---

## 1. RÉSUMÉ EXÉCUTIF

Le projet est une application de gestion de salons de coiffure pour le marché algérien. Il comprend une app mobile React Native (Expo), une API NestJS déployée sur Railway, un panneau admin Next.js, et une base Supabase (PostgreSQL). Le code montre un niveau de maturité avancé avec une architecture bien pensée, des patterns de sécurité corrects (guards, RLS, audit logs), et une logique métier riche.

**Progression globale estimée : 78%**

Le projet est fonctionnel dans ses flux principaux (auth, réservation, gestion salon, abonnements dynamiques), mais présente des blocages critiques en base de données (migrations cassées) et des fonctionnalités importantes manquantes (favoris, notifications d'expiration, tableau admin Next.js non fonctionnel sur nouveau déploiement).

---

## 2. SCORES PAR CATÉGORIE

| Catégorie | Score | Justification |
|---|---|---|
| **Frontend Mobile** | 74/100 | Bon design, navigation correcte, 27 fichiers en @ts-nocheck, favoris absents, double polling |
| **Backend NestJS** | 82/100 | Architecture solide, guards corrects, endpoints complets, 2 bugs logique métier (mois-31, fallback Chargily) |
| **Base de données** | 58/100 | Migrations critiques cassées (colonne `date`, RLS `user_id`, RPCs absentes), mais schéma global bien conçu |
| **Intégration** | 73/100 | Types partagés désynchronisés (commune, phone, force_closed, is_walk_in), admin panel URL buggée |
| **Sécurité** | 79/100 | Bons guards NestJS, RLS présente, Chargily webhook signé, role cache non distribué, injection .or() mineure |
| **Performance** | 72/100 | Redis présent, cache slots correct, mais getSalonClients sans pagination + double polling dashboard |
| **Production Readiness** | 65/100 | Bloqué par les 4 migrations SQL critiques non applicables en l'état |

---

## 3. PROGRESSION GLOBALE

```
Frontend:        ████████████████████░░░░  74%
Backend:         ████████████████████░░░░  82%
Database:        ██████████████░░░░░░░░░░  58%
Integration:     ██████████████████░░░░░░  73%
Security:        ████████████████████░░░░  79%
Performance:     ██████████████████░░░░░░  72%
Production:      ████████████████░░░░░░░░  65%

PROGRESSION GLOBALE :  78% terminé
```

---

## 4. AUDIT FRONTEND

### Score : 74/100

#### Ce qui fonctionne bien ✅
- Navigation role-based (Client / Coiffeur / Admin) correctement implémentée
- Auth flow complet : login téléphone, OTP, inscription, reset mot de passe
- HomeScreen : carte MapLibre + liste salons par wilaya, filtres fonctionnels
- ExploreScreen : recherche, filtres par wilaya, liste complète
- DashboardScreen (Barber) : vues Jour/Mois/Tout, statistiques calculées, temps réel via Realtime
- SubscriptionScreen : entièrement dynamique depuis l'API, affiche état Trial/Active/Expired
- AdminDashboardScreen : gestion salons, utilisateurs, réservations via apiClient
- BookingScreen : sélection service/barbier/créneau/date, flux complet
- SalonDetailScreen : détail complet, portfolio, avis, bouton réserver
- CalendarScreen : vue calendrier des réservations du salon
- ClientsScreen : séparation App Members vs Walk-in fonctionnelle
- SalonSetupScreen : formulaire complet avec carte de positionnement
- MySalonScreen : gestion services, staff, portfolio, horaires, toggle fermeture

#### Problèmes détectés ⚠️

**[CRITICAL] — Migration DB cassée rend tout le booking impossible**
- Fichier : `supabase/migrations/20260609140000_audit_fixes.sql`
- Colonne `date` au lieu de `appointment_date` dans le trigger anti-doublon
- Impact : toutes les réservations crashent si cette migration est appliquée

**[CRITICAL] — 27 fichiers en `@ts-nocheck`**
- Tous les screens, navigateurs, hooks, composants
- Impact : aucune erreur TypeScript remontée, bugs silencieux en production

**[HIGH] — DashboardScreen : double polling (refetchInterval + Realtime)**
- `refetchInterval: 2 * 60 * 1000` actif en même temps que `useRealtimeBookings`
- Impact : requêtes redondantes, consommation data mobile inutile

**[HIGH] — DashboardScreen mode "month"/"all" charge tout l'historique**
- Requête `/reservations/salon/:id` sans filtre date retourne TOUTES les réservations
- Filtrage ensuite en client-side
- Impact : pour un salon actif 1 an → potentiellement 600+ réservations chargées

**[HIGH] — Auto-suppression blocs expirés dans useEffect côté client**
- `useEffect` déclenche des `DELETE` API sur les blocs expirés à chaque render
- Impact : suppressions multiples possibles, logique devrait être côté serveur

**[MEDIUM] — SalonSetupScreen : coordonnées `|| 0` détecte 0 comme falsy**
- `latitude: existingSalon?.latitude || 36.7538`
- Si `latitude = 0` (Null Island), le salon retombe sur les coordonnées d'Alger
- Fix : utiliser `?? 36.7538` (nullish coalescing)

**[MEDIUM] — HomeScreen : memory leak potentiel watchPositionAsync**
- Subscription créée dans un IIFE async — si le composant se démonte avant resolve, le cleanup ne l'atteint pas
- Impact : warning React "update on unmounted component"

**[MEDIUM] — SalonDetailScreen : accès `salon.services` sans garde sur null**
- Pendant le chargement, `salon` est undefined
- `const services = salon?.services ?? []` — OK sur cette ligne, mais `(salon as Record).services` ailleurs non gardé

**[MEDIUM] — MyAppointmentsScreen : check `reviews` incohérent Array/Object**
- `item.reviews.length === 0 || Object.keys(item.reviews).length === 0`
- Si reviews est un objet Supabase, `.length` retourne `undefined`
- Impact : bouton "Évaluer" peut apparaître après soumission d'un avis

**[MEDIUM] — Favoris / Wishlist absent**
- Prévu dans le plan produit, `isFavorited` state présent dans SalonDetailScreen mais bouton ne fait rien (setState sans API)
- Impact : fonctionnalité visible (icône cœur) mais non fonctionnelle

**[LOW] — AdminTabNavigator : seulement 2 onglets (Dashboard + Paramètres)**
- L'admin mobile manque : gestion abonnements, revenus, logs d'audit
- Ces fonctionnalités n'existent que dans le Next.js admin panel

**[LOW] — Timezone Algeria hardcodée `+3600000` (UTC+1 fixe)**
- `new Date(Date.now() + 60 * 60 * 1000)` dans DashboardScreen et Backend
- Algeria est en CET (UTC+1) sans DST — actuellement correct, mais approche fragile
- Impact mineur : l'Algérie n'applique pas le DST, risque théorique seulement

---

## 5. AUDIT BACKEND

### Score : 82/100

#### Ce qui fonctionne bien ✅
- Architecture NestJS modulaire complète (11 modules)
- Guards SupabaseAuthGuard + RolesGuard correctement appliqués
- GlobalPrefix `/api/v1` configuré
- Validation globale `ValidationPipe` avec `whitelist: true`
- Throttling global (100 req/min) + throttle spécifique sur checkout (5/min)
- Helmet security headers
- Sentry monitoring configuré
- Redis cache pour les slots (90s TTL, invalidation sur réservation)
- Supabase adminClient (service_role) pour bypass RLS côté API
- Swagger désactivé en production
- Audit logs via AuditService
- Cron daily pour vérification abonnements
- `salons.findAll()` : filtre `is_approved=true + Expired exclus + complétude salon`
- `reservations.create()` : 8+ vérifications avant création (completude, plan, past-time, etc.)

#### Problèmes détectés ⚠️

**[CRITICAL] — `getDashboardStats` : date fin de mois hardcodée à `-31`**
- Ligne ~603 `salons.service.ts` : `.lte('appointment_date', '${yearMonth}-31')`
- Février n'a que 28/29 jours — stats incorrectes
- Fix : `new Date(year, month, 0).getDate()`

**[HIGH] — `findNearby` ne filtre pas `subscription_status = 'Expired'`**
- `findAll()` filtre `.neq('subscription_status', 'Expired')` mais `findNearby()` via RPC ne le fait pas
- Les salons expirés apparaissent sur la carte HomeScreen
- Impact : violation logique métier

**[HIGH] — Chargily `createCheckoutUrl` : fallback mock silencieux en production**
- Dans le bloc `catch`, retourne une URL `fallback-{timestamp}` au lieu de lever une exception
- Impact : si Chargily est indisponible, le barber reçoit une URL invalide sans message d'erreur

**[HIGH] — `addStaff` : check unicité par `custom_name` uniquement**
- `.ilike('custom_name', customName)` — mais `custom_name` est null pour les barbers liés à un profil
- Un barber avec compte app peut être ajouté plusieurs fois

**[MEDIUM] — `findOne` réservation utilise `.single()` sur la vérification staff**
- Lève `PGRST116` si pas de staff trouvé → retourne 500 au lieu de 403
- Fix : utiliser `.maybeSingle()`

**[MEDIUM] — `getSalonClients` sans pagination**
- Retourne toutes les réservations non-annulées sans `limit()`
- Pour un salon actif 1 an : 600+ réservations chargées avec jointures profiles+services

**[MEDIUM] — Role cache en mémoire (`Map`) non distribué**
- `const roleCache = new Map()` dans `auth.guard.ts` — module-level
- En multi-instance Railway, chaque instance a son propre cache
- Un changement de rôle peut persister 5 min sur les autres instances
- Fix : stocker dans Redis (déjà disponible)

**[MEDIUM] — `blockTime` : injection PostgREST via `.or()` construit dynamiquement**
- `.or('barber_id.eq.${barberId}${staffId ? ',staff_id.eq.${staffId}' : ''}')` 
- Validé comme UUID en amont, risque limité mais pattern dangereux

**[LOW] — `APP_URL` non déclaré dans `env.validation.ts`**
- Fallback hardcodé `https://7afefli.app` si non défini
- Impact : lien de reset password pointe vers un domaine générique

**[LOW] — `deleteUser` (admin) : loop séquentielle sur salons avec `for...of`**
- Si un user a plusieurs salons (cas impossible via contrainte DB actuellement, mais défensivement risqué)

---

## 6. AUDIT BASE DE DONNÉES

### Score : 58/100

#### Ce qui fonctionne bien ✅
- Schéma global cohérent (profiles, salons, services, reservations, reviews, etc.)
- Colonnes `commune` et `phone` ajoutées à `salons` (migration 20260609153000)
- Colonne `is_walk_in` ajoutée à `reservations`
- `client_subscriptions` créée (migration 20260609180000)
- `force_closed` supprimé de `salons` (migration 20260609180000)
- `response` et `response_date` supprimés de `reviews` (migration 20260609180000)
- RLS activée sur `reservations` avec politiques INSERT pour clients et barbers
- RLS activée sur `client_subscriptions`
- Trigger `prevent_salon_escalation` avec bypass service_role correctement configuré
- Migration `auto_create_subscription` utilise `ON CONFLICT DO NOTHING` (idempotente)
- `subscription_plan` ENUM supprimé, colonne `plan` migrée vers TEXT puis UUID FK

#### Problèmes détectés ⚠️

**[CRITICAL — BLOQUANT] — Trigger `check_reservation_overlap` : colonne `date` inexistante**
- `supabase/migrations/20260609140000_audit_fixes.sql` ligne 11
- `AND date = NEW.date` — la colonne s'appelle `appointment_date`
- Impact : si migration appliquée, **100% des INSERT dans `reservations` échouent**

**[CRITICAL — BLOQUANT] — RLS `user_subscriptions` : `user_id` inexistant**
- Même fichier ligne 38 : `USING (auth.uid() = user_id)`
- La table `user_subscriptions` utilise `salon_id` (pas `user_id`)
- Impact : les clients Supabase ne peuvent pas lire leur abonnement directement

**[CRITICAL — BLOQUANT] — Trigger statuts en minuscules vs app en majuscules**
- `status NOT IN ('cancelled', 'rejected')` — l'app utilise `'Cancelled'`, `'Confirmed'`
- Impact : l'anti-double-booking ne filtre aucun statut de l'application réelle

**[CRITICAL] — 5 fonctions RPC critiques absentes de `supabase/migrations/`**
- `create_reservation_safe` (TOUTE réservation passe par là)
- `expire_client_reservations` / `expire_salon_reservations`
- `sync_all_subscription_statuses` (cron daily)
- `find_nearby_salons` (carte HomeScreen, nécessite PostGIS)
- Ces fonctions existent dans `services/api/migrations/` (non géré par Supabase CLI)
- Impact : déploiement sur Supabase vierge → application non fonctionnelle

**[HIGH] — Migration `20260609160000` : `DROP COLUMN plan CASCADE` dangereuse**
- Supprime la colonne avec CASCADE (détruit indexes et FK associés silencieusement)
- Puis `RENAME COLUMN plan_id TO plan` — échoue si `plan_id` n'existe pas
- Impact : état de la colonne `plan` indéterminé selon historique des migrations

**[HIGH] — Table `wilayas` absente de `supabase/migrations/`**
- `create_wilayas_table.sql` est dans `services/api/migrations/` seulement
- `/locations/wilayas` retournera 500 sur un Supabase propre

**[HIGH] — Trigger `loyalty_points` affecte les walk-ins**
- `UPDATE profiles SET loyalty_points = loyalty_points + 10 WHERE id = NEW.client_id`
- Pour une réservation walk-in, `client_id` = le barber qui crée
- Impact : les barbers accumulent des points fantômes

**[MEDIUM] — `find_nearby_salons` RPC ne filtre pas les salons Expirés**
- `WHERE s.is_approved = true` mais pas `AND s.subscription_status != 'Expired'`
- Impact : salons expirés visibles sur la carte

**[MEDIUM] — Indexes performants dans `services/api/migrations/` seulement**
- `add_missing_indexes.sql` et `add_performance_indexes.sql` non inclus dans `supabase/migrations/`
- Index manquants sur `reservations(appointment_date)`, `reservations(salon_id, appointment_date)`

---

## 7. AUDIT INTÉGRATION

### Score : 73/100

#### Ce qui fonctionne ✅
- `apiClient.ts` correctement configuré avec `EXPO_PUBLIC_API_URL + /api/v1`
- Auth token JWT automatiquement injecté depuis Supabase session
- React Query utilisé correctement pour le cache et la synchronisation
- Realtime Supabase branché sur les réservations (useRealtimeBookings)
- Subscription plans entièrement dynamiques depuis l'API (SubscriptionScreen)
- Walk-in vs app members correctement séparés dans ClientsScreen
- Types partagés via `@barberdz/shared` correctement importés

#### Problèmes d'intégration ⚠️

**[CRITICAL] — Type partagé `Salon` manque `commune` et `phone`**
- `packages/shared/types/salon.ts` — ces colonnes existent en DB depuis migration 20260609153000
- Code accède via `(salon as any).commune` ou pas du tout → erreurs silencieuses

**[CRITICAL] — Type partagé `Salon` contient `force_closed` supprimé de DB**
- `force_closed: boolean` dans le type mais colonne supprimée en migration 20260609180000
- Impact : désynchronisation type/DB, accès retourne `undefined` sans erreur TS

**[HIGH] — Type partagé `Reservation` manque `is_walk_in`**
- `is_walk_in: boolean` utilisé partout dans DashboardScreen/ClientsScreen mais absent de l'interface
- Accès via `(r as any).is_walk_in` dans tout le code

**[HIGH] — `description` optionnel dans CreateSalonDto mais bloquant pour réservations**
- `@IsOptional()` dans le DTO → salon peut être créé sans description
- Mais `reservations.service.ts` : `if (!hasDesc) throw BadRequest`
- Impact : le barber crée son salon sans description, les clients ne peuvent jamais réserver

**[MEDIUM] — `BlockTimeModal` ne peut bloquer que les créneaux du propriétaire**
- Passe `barberId = user.id` — seulement les créneaux du barber connecté
- Si multi-staff, le propriétaire ne peut pas bloquer les créneaux de ses employés

**[MEDIUM] — Réponses avis (`owner_response`) dans `services/api/migrations/` seulement**
- `add_review_response.sql` définit `owner_response` et `owner_response_at`
- Absent de `supabase/migrations/` → les réponses aux avis ne fonctionnent pas sur Supabase propre

**[LOW] — PlanItem type dans SubscriptionScreen manque le champ `icon`**
- Utilisé comme `(plan.icon || 'star-outline') as any`
- `icon` n'est pas dans l'interface `PlanItem` locale (possible que le backend le renvoie)

---

## 8. AUDIT PAR RÔLE

### CLIENT ✅ Fonctionnel à ~78%

**Ce qui fonctionne :**
- Inscription/Login/OTP/Reset password
- Recherche salons par wilaya (HomeScreen + ExploreScreen)
- Carte interactive avec marqueurs
- Filtres (proximité, note, services)
- Voir détail salon : info, services, staff, portfolio, avis
- Réserver : sélection service → barbier → date → créneau → confirmation
- Voir ses rendez-vous (à venir + historique)
- Laisser un avis (après RDV Completed)
- Profil et paramètres (modifier nom, avatar)
- Points de fidélité affichés

**Ce qui manque :**
- Favoris (bouton présent, setState seulement, aucune persistance)
- Utilisation des points de fidélité (affichés uniquement)
- Notifications push en cas d'annulation/confirmation (backend prêt, mobile partiellement)
- Historique de paiement client
- Plan client premium (UI inexistante pour s'abonner côté client)

---

### BARBER (COIFFEUR) ✅ Fonctionnel à ~82%

**Ce qui fonctionne :**
- Setup salon guidé (SalonSetupScreen)
- Gestion complète du salon (MySalonScreen) : services, staff, portfolio, horaires
- Dashboard temps réel (DashboardScreen) : réservations jour/mois/tout
- Statistiques : nb réservations, en attente, revenus estimés
- Confirmer / Annuler / Terminer réservations
- Ajouter walk-in (sans RDV)
- Bloquer créneaux horaires
- Vue calendrier (CalendarScreen)
- Gestion clients (ClientsScreen) avec séparation App Members / Walk-in
- Abonnements dynamiques (SubscriptionScreen) avec paiement Chargily
- Toggle ouverture/fermeture rapide du salon
- Stats avancées (Pro/Premium uniquement) via `/salons/dashboard-stats`

**Ce qui manque :**
- Répondre aux avis clients (UI non implémentée côté mobile)
- Notifications push à l'expiration de l'abonnement
- Statistiques de revenus calculées via `getDashboardStats` (le Dashboard calcule client-side à la place)
- `BlockTimeModal` : ne peut pas bloquer les créneaux des autres barbers
- Upload portfolio : pas d'indicateur de progression

---

### ADMIN ✅ Fonctionnel à ~70%

**Ce qui fonctionne (dans AdminDashboardScreen mobile) :**
- Vue salons : liste, approbation/révocation, suppression
- Vue utilisateurs : liste, changement de rôle (Client↔Coiffeur), ban, suppression
- Vue réservations : liste complète
- Stats globales (total salons, approuvés, en attente, utilisateurs)
- Sponsorisation de salons

**Ce qui manque :**
- Panel Next.js (apps/admin) entièrement non testé sur déploiement propre (URL `/api/v1` manquante potentiellement)
- Mobile Admin : onglet unique, pas de gestion des abonnements, pas de revenus, pas de logs d'audit
- Voir les logs d'audit (accessible via API `/admin/audit` mais pas d'UI mobile)
- Export CSV des logs (existe en backend seulement)
- Revenue stats (existe en backend `/admin/revenue`, pas d'UI mobile)
- Gestion des plans d'abonnement (CRUD plans inexistant côté admin)

---

## 9. AUDIT MAPS

### Score global Maps : 76/100

**HomeScreen Map ✅**
- SalonMapView (MapLibre GL via WebView) avec marqueurs sur tous les salons filtrés
- Synchronisation carte ↔ liste (scroll auto sur sélection marqueur)
- Localisation GPS avec fallback Alger si hors Algeria
- Bounding box sur 58 wilayas (correctement implémenté)
- Throttle GPS : `distanceInterval: 50m, timeInterval: 30s`

**ExploreScreen ✅**
- Carte + liste avec filtres wilaya/service/note
- Importation WILAYA_BOUNDS depuis `@barberdz/shared/constants/wilayas`

**SalonMapView Component ✅**
- Communication WebView↔RN via `postMessage`
- `injectJavaScript` pour éviter le remount WebView (correctement implémenté)
- Popup salon avec photo + nom + note

**Problèmes Maps :**

**[HIGH] — `find_nearby_salons` RPC absente de `supabase/migrations/`**
- Le endpoint `/salons/nearby` a un fallback mais sans PostGIS → résultats non géolocalisés

**[HIGH] — `find_nearby_salons` ne filtre pas les Expirés**
- `WHERE s.is_approved = true` seulement — les salons expirés visibles sur la carte

**[MEDIUM] — WILAYA_BOUNDS dupliquées dans HomeScreen**
- 90 lignes de données de wilayas hardcodées dans HomeScreen alors que `packages/shared/constants/wilayas.ts` existe

**[MEDIUM] — Popups MapLibre potentiellement bloquées sur Android WebView anciens**
- Communication `window.ReactNativeWebView.postMessage` peut échouer
- Pas de fallback détecté si le message ne passe pas

**[LOW] — Pas de clustering de marqueurs**
- Si beaucoup de salons dans une wilaya, les marqueurs se superposent

---

## 10. AUDIT ABONNEMENTS

### Système dynamique : OUI ✅ (entièrement)

**Ce qui fonctionne :**
- Plans lus depuis la table `plans` (DB, dynamique)
- Prix, durée, max_barbers, max_photos, max_reservations tous lus depuis DB
- `addStaff` vérifie `max_barbers` depuis DB
- `addPortfolioPhoto` vérifie `max_portfolio_photos` depuis DB
- `create()` réservation vérifie `max_reservations` depuis DB
- `getDashboardStats` vérifie `advanced_statistics` depuis DB
- SubscriptionScreen affiche plans dynamiquement, filtres par sort_order
- Statut Trial → Free automatique via cron daily
- Chargily Pay intégré avec vérification signature HMAC-SHA256
- Durée d'abonnement lue depuis `plans.duration_days` (dynamique)

**Problèmes :**

**[CRITICAL] — RLS `user_subscriptions` cassée**
- `USING (auth.uid() = user_id)` — colonne inexistante
- Impact : les barbers ne peuvent pas lire leur abonnement depuis le client Supabase

**[HIGH] — Chargily fallback mock en production**
- Si Chargily est indisponible → URL invalide retournée silencieusement

**[MEDIUM] — Expiration trial sans notification**
- Le cron expire silencieusement → le barber découvre son salon masqué sans avoir été prévenu

**[MEDIUM] — `client_subscriptions` : `plan !== 'Free'` hardcodé**
- `if (subscription.plan !== 'Free')` — si le slug change, la logique est cassée
- Fix : utiliser une colonne booléenne `is_premium` ou un champ dans la table plans

**[LOW] — Plans dans SubscriptionScreen : `icon` non standardisé**
- `(plan.icon || 'star-outline') as any` — le champ `icon` n'est pas dans le type `PlanItem`

---

## 11. AUDIT GESTION SALON

### Score : 81/100

**Ce qui fonctionne ✅**
- Création salon avec tous les champs obligatoires (SalonSetupScreen)
- Mise à jour des informations (EditSalonModal)
- Upload photo de couverture + portfolio (Supabase Storage signé)
- Gestion services (CRUD via ServiceModal)
- Gestion staff (AddStaffModal, suppression, avatar)
- Horaires (open_time, close_time, working_days)
- Portfolio photos (avec quota dynamique par plan)
- Indicateur de complétude salon (isComplete)
- Toggle ouverture/fermeture manuelle

**Problèmes :**

**[HIGH] — `description` optionnel (DTO) mais bloquant (réservations)**
- Voir section Intégration

**[MEDIUM] — Race condition quota portfolio photos**
- La vérification du quota et l'upload sont deux opérations séparées
- Deux uploads simultanés peuvent dépasser la limite en parallèle

**[MEDIUM] — `addStaff` check uniquement sur `custom_name`**
- Un barber avec profil app (pas de custom_name) peut être ajouté deux fois

**[LOW] — Pas d'indicateur de progression upload portfolio**
- L'upload peut être long sur connexion mobile algérienne — UX dégradée

**[LOW] — MySalonScreen : pas de confirmation avant suppression service**
- La suppression d'un service avec des réservations futures associées n'est pas bloquée côté frontend

---

## 12. AUDIT SÉCURITÉ

### Score : 79/100

**Mesures en place ✅**
- Helmet security headers (HSTS, CSP, etc.)
- Guards SupabaseAuthGuard + RolesGuard sur tous les endpoints sensibles
- `ValidationPipe(whitelist: true)` — propriétés inconnues supprimées
- Chargily webhook : vérification signature HMAC-SHA256 ✅
- Supabase `service_role` côté backend seulement (clients n'ont pas accès admin)
- RLS activée sur `reservations`, `client_subscriptions`, `user_subscriptions`
- Audit logs via AuditService
- Throttling global + spécifique checkout
- Swagger désactivé en production

**Problèmes :**

**[CRITICAL] — RLS `user_subscriptions` cassée (colonne inexistante)**
- Permet théoriquement des lectures non autorisées si la politique ne s'applique pas

**[HIGH] — Role cache non distribué**
- Changement de rôle prend effet immédiatement sur l'instance locale
- Mais les autres instances Railway conservent l'ancien rôle jusqu'à 5 min

**[HIGH] — `unblockTime` : seul le créateur exact peut débloquer**
- `if (reservation.barber_id !== userId && reservation.client_id !== userId)` → le propriétaire du salon ne peut pas débloquer les blocs de ses employés

**[MEDIUM] — `blockTime` injection `.or()` dynamique**
- String interpolation dans une query PostgREST — validé UUID en amont, risque limité

**[MEDIUM] — CORS configuré mais non audité**
- `ALLOWED_ORIGINS` lue depuis env — default `localhost:3000,localhost:8081`
- En production, non configuré = CORS trop restrictif ou trop permissif selon la valeur

---

## 13. AUDIT PERFORMANCE

### Score : 72/100

**Points forts ✅**
- Redis (Upstash) pour le cache des slots (90s TTL)
- Invalidation cache correcte sur création/annulation réservation
- Requêtes parallèles `Promise.all()` dans `reservations.create()`
- Pagination dans `findAll()` salons (limit/offset)
- Index correctement configurés dans `add_missing_indexes.sql`
- `staleTime` React Query correctement configurés (2-10 min selon le contexte)

**Problèmes :**

**[HIGH] — DashboardScreen double polling**
- `refetchInterval: 2min` + Realtime simultanés → requêtes redondantes

**[HIGH] — `getSalonClients` sans pagination**
- Charge toutes les réservations non-annulées + jointures profiles+services
- O(réservations * staff + réservations * services) sans borne

**[HIGH] — DashboardScreen mode "all/month" : tout l'historique chargé en mémoire**
- Filtrage client-side d'une réponse potentiellement massive

**[MEDIUM] — `invalidateSlotsCache` : loop O(services × staff) d'appels Redis**
- Sans `barberId`, itère sur tous les services × staff pour `del()`
- Fix : pattern de clés avec préfixe + `SCAN+DEL` ou index de clés

**[MEDIUM] — `findOne` réservation : extra SELECT si ni client ni barber ni owner**
- SELECT supplémentaire vers `salon_staff` pour vérifier le rôle de staff

---

## 14. ROADMAP — CE QUI RESTE À FAIRE

### 🔴 PRIORITÉ HAUTE — Bloquants production

| # | Tâche | Impact |
|---|---|---|
| P1 | **Corriger trigger `check_reservation_overlap`** : `date` → `appointment_date`, statuts `'Cancelled'`/`'Completed'` | Toutes réservations crash |
| P2 | **Corriger RLS `user_subscriptions`** : `user_id` → `EXISTS(SELECT 1 FROM salons WHERE id=salon_id AND owner_id=auth.uid())` | Abonnements illisibles |
| P3 | **Déplacer les 5 RPCs dans `supabase/migrations/`** : `create_reservation_safe`, `expire_*`, `find_nearby_salons`, `sync_all_subscription_statuses` | App non fonctionnelle sur Supabase propre |
| P4 | **Ajouter filtre `subscription_status != 'Expired'` dans `find_nearby_salons`** | Salons expirés visibles carte |
| P5 | **Corriger `getDashboardStats` : hardcode `-31` → date dynamique** | Stats mensuelles incorrectes |
| P6 | **Migrer `wilayas` table dans `supabase/migrations/`** | LocationsService crash |
| P7 | **Migrer indexes performance dans `supabase/migrations/`** | Performances dégradées |
| P8 | **Corriger Chargily fallback silencieux** : lever exception en production | Paiements perdus silencieusement |
| P9 | **Supprimer @ts-nocheck progressivement** (fichiers critiques en premier) | Bugs silencieux en production |

---

### 🟠 PRIORITÉ MOYENNE — Sprint suivant

| # | Tâche | Impact |
|---|---|---|
| M1 | **Mettre à jour types partagés** : ajouter `commune`, `phone`, `is_walk_in`; supprimer `force_closed` | Typage incorrect partout |
| M2 | **Rendre `description` obligatoire dans `CreateSalonDto`** OU retirer de la vérification completude | Blocage réservations inattendu |
| M3 | **Implémenter favoris** : table `salon_favorites`, endpoints CRUD, SalonDetailScreen | Feature attendue |
| M4 | **Notification expiration abonnement** : push notification 7j avant + au moment de l'expiration | Barbers surpris |
| M5 | **Supprimer `refetchInterval`** dans DashboardScreen (Realtime suffit) | Requêtes redondantes |
| M6 | **Paginer `getSalonClients`** ou dénormaliser dans une table stats | Performance |
| M7 | **Fixer `addStaff` check unicité** : vérifier aussi `profile_id` | Doublons staff |
| M8 | **Fixer memory leak `watchPositionAsync`** dans HomeScreen | Warning React |
| M9 | **Fixer `reviews` check** dans MyAppointmentsScreen : `Array.isArray()` | Bouton "Évaluer" fantôme |
| M10 | **Migrer role cache vers Redis** | Changements rôle non propagés |
| M11 | **Utiliser `??` au lieu de `||`** pour coordonnées dans SalonSetupScreen | Coordonnées reset à Alger |

---

### 🟢 PRIORITÉ FAIBLE — Dette technique

| # | Tâche | Impact |
|---|---|---|
| L1 | **Extraire WILAYA_BOUNDS dans HomeScreen** → `packages/shared` | Duplication code |
| L2 | **Implémenter réponses aux avis** (UI mobile) | Fonctionnalité attendue |
| L3 | **Ajouter progression upload portfolio** | UX mobile |
| L4 | **Ajouter clustering marqueurs carte** | UX maps |
| L5 | **Implémenter loyalty points utilisables** (rédemption) | Feature promise |
| L6 | **Panel admin mobile** : onglets revenus + logs audit | Admin incomplet mobile |
| L7 | **Plan client premium** : page d'abonnement côté client | Revenue stream |
| L8 | **Renommer PhoneInputScreen/PhoneEntryScreen** pour clarté | Maintenabilité |
| L9 | **Indicateur complétude salon** : afficher % côté barber dans MySalonScreen | UX barber |
| L10 | **Tests unitaires** : actuellement uniquement des .spec.ts vides | Qualité code |

---

## 15. SYNTHÈSE PRODUCTION READINESS

```
✅ Auth & Sessions          — Prêt
✅ Booking Flow             — Prêt (si migrations SQL corrigées)
✅ Salon Management         — Prêt
✅ Subscription System      — Prêt (dynamique)
✅ Chargily Payments        — Prêt (corriger fallback silencieux)
✅ Maps & Géolocalisation   — Prêt (si RPC find_nearby_salons migrée)
✅ Admin Dashboard Mobile   — Prêt
⚠️ Database Migrations      — BLOQUANT (4 migrations critiques)
⚠️ Type Safety              — Partiel (27 fichiers @ts-nocheck)
❌ Favoris                  — Non implémenté
❌ Loyalty Redemption       — Non implémenté
❌ Admin Panel Next.js      — Non vérifié sur déploiement propre
```

**Le projet peut être mis en production dès que les 9 points PRIORITÉ HAUTE sont corrigés.**
