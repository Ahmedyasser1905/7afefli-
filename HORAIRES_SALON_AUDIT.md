# AUDIT GESTION HORAIRES ET ÉTAT DU SALON

Ce document présente l'audit et le rapport d'implémentation pour la logique d'ouverture, de fermeture et de gestion des horaires 24H/24 des salons.

---

## 1. Fichiers Modifiés

### Base de données (Supabase / Postgres)
* **RPC Database** : Mise à jour de la fonction `create_reservation_safe`
* **Migration SQL** : [add_is_manually_closed.sql](file:///c:/Users/dz%20laptops/Desktop/projets/Barber/services/api/migrations/add_is_manually_closed.sql)

### Shared Packages
* [salon.ts](file:///c:/Users/dz%20laptops/Desktop/projets/Barber/packages/shared/types/salon.ts) (Mise à jour des types)

### Backend (NestJS)
* [update-salon.dto.ts](file:///c:/Users/dz%20laptops/Desktop/projets/Barber/services/api/src/salons/dto/update-salon.dto.ts) (Ajout de `is_manually_closed`)
* [salons.service.ts](file:///c:/Users/dz%20laptops/Desktop/projets/Barber/services/api/src/salons/salons.service.ts) (Enrichissement dynamique des statuts)
* [slots.service.ts](file:///c:/Users/dz%20laptops/Desktop/projets/Barber/services/api/src/slots/slots.service.ts) (Arrêt de la génération si fermé)
* [reservations.service.ts](file:///c:/Users/dz%20laptops/Desktop/projets/Barber/services/api/src/reservations/reservations.service.ts) (Blocage au niveau service)

### Frontend (React Native)
* [DashboardScreen.tsx](file:///c:/Users/dz%20laptops/Desktop/projets/Barber/apps/mobile/src/screens/barber/DashboardScreen.tsx) (Toggle ouverture/fermeture)
* [SalonCard.tsx](file:///c:/Users/dz%20laptops/Desktop/projets/Barber/apps/mobile/src/components/salon/SalonCard.tsx) (Badge de statut)
* [SalonDetailScreen.tsx](file:///c:/Users/dz%20laptops/Desktop/projets/Barber/apps/mobile/src/screens/client/SalonDetailScreen.tsx) (Badge et blocage CTA de réservation)
* [BookingScreen.tsx](file:///c:/Users/dz%20laptops/Desktop/projets/Barber/apps/mobile/src/screens/client/BookingScreen.tsx) (Écran de blocage si fermé)
* [CalendarScreen.tsx](file:///c:/Users/dz%20laptops/Desktop/projets/Barber/apps/mobile/src/screens/barber/CalendarScreen.tsx) (Correction de la timeline si 24H)

---

## 2. Logique Métier Appliquée

La logique d'état des salons est centralisée sur le backend et renvoie de manière cohérente :
1. `is_open_24h` : Déterminé si `open_time === close_time` ou si les deux valent `00:00`.
2. `is_currently_open` : Déterminé selon l'heure locale d'Algérie (UTC+1) en vérifiant le jour de la semaine (`working_days`) et les heures de début/fin (en gérant le passage de minuit).
3. `status_label` : Valeur finale du statut :
   * `'manually_closed'` (Fermeture temporaire)
   * `'open_24h'` (24H/24)
   * `'open'` (Ouvert)
   * `'closed'` (Fermé)

---

## 3. Flux de Réservation

1. **Vérification Frontend** :
   * Sur la carte du salon et la liste : Affiche le badge approprié (🟢 Ouvert, 🔴 Fermé, 🟢 24H/24, 🟠 Fermeture temporaire).
   * Sur la page de détail : Si `is_manually_closed` est actif, le bouton "Continuer" est désactivé et affiche "Salon temporairement fermé".
   * Sur la page de sélection de créneaux : Si le salon est fermé manuellement, affiche un écran d'erreur bloquant la sélection.
2. **Vérification Backend (NestJS)** :
   * `ReservationsService.create` intercepte et rejette la réservation avec une `BadRequestException` si `is_manually_closed` est vrai.
3. **Vérification Base de Données (Postgres)** :
   * L'advisory lock et l'insertion sécurisée via la fonction RPC `create_reservation_safe` vérifient le flag `is_manually_closed` directement dans la table `salons` et déclenchent une exception Postgres si le salon est fermé.

---

## 4. Règles d'Ouverture et de Fermeture (Priorité)

L'ordre de priorité appliqué à tout moment est :
1. **Fermeture manuelle** : `is_manually_closed = true` => Le salon est **Fermé** (🟠 Fermeture temporaire) et aucune réservation n'est possible, aucun créneau n'est généré.
2. **24H/24** : `is_open_24h = true` => Le salon est toujours **Ouvert** (🟢 24H/24) et réservable à n'importe quelle heure sans restriction horaire.
3. **Horaires standards** : Vérification des colonnes `open_time` et `close_time` et des `working_days`.

---

## 5. Impacts Systèmes

### Supabase
* Ajout d'une colonne `is_manually_closed` (BOOLEAN DEFAULT FALSE) sur la table `salons`.
* Création de l'index `idx_salons_is_manually_closed` pour optimiser le filtrage.
* Modification de la fonction `create_reservation_safe` pour lever une exception Postgres en cas de fermeture manuelle.

### Backend
* Centralisation de la logique horaire et du fuseau horaire algérien dans `salons.service.ts` via le helper `enrichSalon`.
* Blocage des créneaux dans `slots.service.ts` en retournant un tableau vide si le salon est fermé manuellement.
* Double verrouillage de sécurité dans `reservations.service.ts`.

### Frontend
* Bouton dynamique d'ouverture/fermeture manuelle dans le Dashboard du coiffeur.
* Remplacement des logiques de temps hardcodées par la lecture directe de `status_label` et `is_currently_open` fournis par l'API.

---

## 6. Bugs Trouvés & Corrigés

1. **Bug de Timeline Calendar (Barber)** : Dans `CalendarScreen.tsx`, si le salon était ouvert 24H (ex. `09:00` à `09:00`), la formule `Math.max(closeHour - openHour, 1)` calculait `1` heure pour la timeline entière au lieu de 24.
   * *Correction* : Si le salon est 24H, la timeline force automatiquement `openHour = 0` et `closeHour = 24`.
2. **Doublons de validation** : Les clients pouvaient auparavant bypasser l'interface web/mobile pour réserver en dehors des heures de travail car le backend ne validait pas les jours et heures de travail au moment de la création physique de la réservation.
   * *Correction* : La fonction Postgres `create_reservation_safe` et le backend bloquent désormais de façon étanche toute réservation si le salon est fermé manuellement.

---

## 7. Tests Réalisés

* **Build NestJS** : Vérifié sans erreur (`npm run build` OK).
* **Compilation TypeScript** : Compilé avec succès sur le frontend mobile (`npx tsc --noEmit` OK).
* **Validation SQL** : Migration appliquée avec succès sur la base Supabase et vérification de la structure et des index.
