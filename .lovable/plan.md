## Objectif

Sur la page Super Admin > Blessés, ajouter un bouton "Matcher" sur chaque ligne de la table "Coureurs ignorés" (raison "Coureur introuvable dans la base") pour associer manuellement le nom PCS à un coureur de la base, sur le même principe que le matching des startlists.

## Comportement

- Pour les lignes avec raison **"Coureur introuvable dans la base"** : afficher un bouton **Matcher** dans la dernière colonne.
- Pour les lignes **"Convalescence terminée"** : pas de bouton (rien à faire).
- Clic sur **Matcher** → ouvre une `Dialog` avec :
  - champ de recherche pré-rempli avec le nom PCS reformaté (`Prénom NOM`),
  - liste de candidats via le RPC existant `search_riders_for_matching(p_saison_id, p_query, p_limit)` (déjà utilisé par `MatchRiderDialog`),
  - bouton **Confirmer le match**.
- À la confirmation :
  1. **Insert** dans `rider_injuries` (upsert sur `coureur_id,injury_date,injury`) avec `coureur_id` choisi, `rider_name_pcs`, `injury`, `injury_date`, `weeks_out` (déjà présent dans `skipped_details` côté front — voir section technique), `source_url` PCS et `last_seen_at = now()`.
  2. Toast de succès.
  3. La ligne est retirée de la liste locale `lastRun.skipped_details` (mise à jour immédiate, pas besoin de relancer le scraping).
  4. Invalidation de `admin-rider-injuries` et `active-rider-injuries` pour faire apparaître la blessure dans le tableau du haut.

Aucun alias créé (le scraper ne consulte pas `name_aliases` pour les blessures). Pour qu'un futur scraping reconnaisse automatiquement le coureur, la solution propre serait d'ajuster `coureurs.nom` ou d'ajouter un champ dédié — hors scope de cette demande. Le matching manuel reste rejouable.

## Détails techniques

### 1. Edge function `scrape-rider-injuries`

Le payload `skipped_details` actuel n'inclut pas `weeks_out`. **Ajouter** `weeks_out: number` au type et à chaque `push` (les deux : "Convalescence terminée" et "Coureur introuvable").

### 2. Nouveau composant `src/components/admin/MatchSkippedInjuryDialog.tsx`

Calqué sur `src/components/admin/startlist-data/MatchRiderDialog.tsx` mais simplifié :
- Props : `skipped: SkipDetail` (avec `weeks_out`), `saisonId: string`, `onClose()`, `onSuccess()`.
- Utilise `useQuery` + `supabase.rpc('search_riders_for_matching', { p_saison_id, p_query, p_limit: 20 })`.
- Au confirme : `supabase.from('rider_injuries').upsert({ coureur_id, rider_name_pcs: skipped.name, injury: skipped.injury, injury_date: skipped.injury_date, weeks_out: skipped.weeks_out, source_url: 'https://www.procyclingstats.com/statistics/latest-injuries.php', last_seen_at: new Date().toISOString() }, { onConflict: 'coureur_id,injury_date,injury' })`.
- Pas de création d'alias.

### 3. `src/pages/admin/SuperAdminInjuriesPage.tsx`

- Étendre le type `SkipDetail` avec `weeks_out: number`.
- Ajouter colonne **Action** dans la table des ignorés.
- Bouton `Matcher` (variant outline, taille sm) visible uniquement si `reason.includes("introuvable")`.
- État local `matchTarget: SkipDetail | null` pour piloter le dialog.
- Récupérer la saison courante via `useSeasonContext()` pour passer `saisonId` au dialog (la RPC l'exige).
- Sur `onSuccess` du dialog : `setLastRun(prev => ({ ...prev, skipped_details: prev.skipped_details.filter(s => s !== matched) }))` et invalider les queries d'injuries.

## Fichiers touchés

- `supabase/functions/scrape-rider-injuries/index.ts` — ajouter `weeks_out` dans `skipped_details`.
- `src/components/admin/MatchSkippedInjuryDialog.tsx` — **nouveau**.
- `src/pages/admin/SuperAdminInjuriesPage.tsx` — colonne action + dialog + retrait local après match.
