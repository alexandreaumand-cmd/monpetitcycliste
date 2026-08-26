# Plan — Arène Live : élargir "Situation", alléger la "Timeline"

## Problème

Sur desktop, la colonne **Situation** (320px fixe) est trop étroite pour être lisible, et la **Timeline** est polluée par les messages de situation répétés : la fonction `live-broadcast-auto-scrape` insère un message `admin_broadcast` dans `arena_messages` à chaque changement de situation détecté (potentiellement toutes les quelques minutes), ce qui noie le fil.

## Changements

### 1. Répartition desktop Timeline / Situation

`src/components/arena/LiveCoursePanel.tsx` :
- Passer la colonne Situation de `w-[320px]` fixe à une largeur plus généreuse : `w-[420px]` (et `w-[320px]` en mode compact, au lieu de 260px).
- La Timeline conserve `flex-1` et absorbe la réduction.

### 2. Situation "live" stockée hors des messages

La colonne Situation ne doit plus dépendre des messages pour être à jour :
- Migration : ajouter `current_race_situation jsonb` et `situation_updated_at timestamptz` à la table `arena_live_courses`.
- `live-broadcast-auto-scrape` : à chaque scrape où la situation change, mettre à jour ces colonnes (UPDATE systématique, pas d'insertion de message).
- `LiveCoursePanel.tsx` : lire la situation depuis `arena_live_courses` (nouvelle requête avec `refetchInterval` ~30 s), avec repli sur le dernier message `race_situation` pour l'historique. L'en-tête Situation garde l'indicateur "🏁 xx km".

### 3. Timeline : copie de la situation toutes les 30 min seulement

`live-broadcast-auto-scrape` :
- N'insérer un message `admin_broadcast` avec `race_situation` dans `arena_messages` que si **au moins 30 minutes** se sont écoulées depuis le dernier message de situation pour cette course/étape (comparaison avec `latestSituationMessage.created_at`, déjà récupéré).
- La diffusion manuelle depuis la page super-admin reste inchangée.

### 4. Indicateur de fraîcheur dans la Timeline

`LiveCoursePanel.tsx` :
- Ajouter une ligne d'info dans l'en-tête de la colonne Timeline : **"Situation mise à jour il y a X s / X min"**, calculée depuis `situation_updated_at` et rafraîchie toutes les 30 s (composant léger type `RelativeTime`, sans dépendance externe).
- Les messages de situation périodiques (30 min) restent affichés dans le fil comme aujourd'hui, mais deviennent rares.

## Technique

- Migration SQL : `ALTER TABLE arena_live_courses ADD COLUMN current_race_situation jsonb, ADD COLUMN situation_updated_at timestamptz;` (pas de nouvelle table, pas de RLS supplémentaire).
- Edge function `live-broadcast-auto-scrape/index.ts` : séparer "mise à jour de la situation courante" (à chaque changement) de "copie dans la timeline" (throttle 30 min). Redéploiement de la fonction.
- `LiveCoursePanel.tsx` : requête `arena_live_courses` (`select current_race_situation, situation_updated_at`), `refetchInterval: 30000`, fallback sur `latestSituation` existant si la colonne est vide.
- Seuil de 30 min en constante nommée pour ajustement facile.

## Vérification

- Build OK + vérification visuelle desktop (Playwright) : colonne Situation élargie, timeline délestée, indicateur "mise à jour il y a …" visible et qui s'incrémente.
