# Planning multi-étapes du Live Broadcast

## Objectif

Aujourd'hui, une course live ne porte qu'un seul lien de scraping (`live_scrape_url`) et une seule plage horaire, qu'il faut mettre à jour manuellement à chaque étape. L'idée : saisir à l'avance les 21 étapes de la Vuelta (lien + date + plages horaires), et laisser le système choisir tout seul l'étape du jour.

## Ce qui change pour l'admin

Dans l'écran super-admin « Live Broadcast », un nouvel onglet **Planning des étapes** pour la course active :

- Un tableau avec une ligne par étape : `N° étape`, `date`, `lien live`, `plages horaires` (début / fin / intervalle), `actif`.
- Bouton « Générer les étapes » qui pré-remplit les lignes 1..N à partir des dates de la course (une étape par jour) et des étapes déjà connues en base.
- Collage en masse : coller une liste de liens (un par ligne) pour remplir les étapes d'un coup.
- Duplication des plages horaires d'une étape vers toutes les autres (ex : 14:00–18:00, toutes les 120 s).
- Badge « étape du jour » sur la ligne active, avec l'heure du prochain scrape.
- L'ancien réglage mono-étape reste visible en repli (utilisé si aucun planning n'est saisi).

## Fonctionnement automatique

À chaque passage du cron (toutes les minutes), pour chaque course live :

1. On cherche la ligne de planning active dont la `date` correspond à aujourd'hui (heure de Paris).
2. Si elle existe : on utilise son lien et ses plages horaires, et on met à jour l'étape courante de la course automatiquement.
3. Si aucune ligne pour aujourd'hui : on retombe sur le lien/planning global de la course (comportement actuel), et si celui-ci est vide, la course est simplement ignorée.

Résultat : une fois les 21 liens saisis, plus aucune intervention quotidienne.

## Détails techniques

**Nouvelle table `live_stage_plans`**
- `course_id` (FK `courses`), `etape_numero` (int, nullable pour une classique), `stage_date` (date), `scrape_url` (text), `scrape_schedule` (jsonb, même format `{start, end, intervalSec}[]`), `is_enabled` (bool, défaut true), `last_auto_scrape_at`, `next_auto_scrape_at`, timestamps.
- Unique sur `(course_id, coalesce(etape_numero,-1))`.
- GRANT `select/insert/update/delete` à `authenticated`, `all` à `service_role`, `select` à `anon` (lecture publique comme `arena_live_courses`) ; RLS : lecture pour tous, écriture réservée aux super-admins (`is_superadmin()`).
- Trigger `updated_at`.

**Edge function `live-broadcast-auto-scrape`**
- Charger les plans du jour (`stage_date = date du jour à Paris`, `is_enabled = true`) pour les courses actives.
- Résolution : plan du jour → sinon champs de `arena_live_courses`.
- Le suivi d'intervalle (`last_auto_scrape_at` / `next_auto_scrape_at`) est écrit sur la ligne de plan quand elle est utilisée, sinon sur `arena_live_courses` comme aujourd'hui.
- Quand un plan est utilisé, aligner `arena_live_courses.current_etape` sur `etape_numero` (utilisé pour les métadonnées de broadcast) et `live_scrape_url` pour l'affichage.
- Logs enrichis : `course_id`, étape retenue, source (`plan` / `fallback`), heure de Paris.

**Front**
- `src/pages/admin/SuperAdminLiveBroadcastPage.tsx` : nouvel onglet + composant `src/components/admin/live/StagePlanEditor.tsx` (tableau éditable, génération, collage en masse, duplication des plages).
- Réutilise l'éditeur de plages existant (`ScrapeScheduleEditor`) par ligne, en mode compact.
- Pré-remplissage des dates via `course_stage_config.stage_date` quand disponible, sinon `date_debut + (n-1) jours`.

## Hors périmètre

- Pas de changement de la logique de scraping elle-même (`scrape-live-race`).
- Pas de récupération automatique des URLs d'étapes depuis un site externe (les liens restent saisis à la main ou collés en masse).
