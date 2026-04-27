## Contexte

La ligue **"T1 - Barb+Amstel"** (mode `per_course`, scope = *De Brabantse Pijl* + *La Flèche Brabançonne* + *Amstel Gold Race*) est en LIVE avec `status = 'active'` alors que sa dernière course (Amstel, 19/04) est terminée.

Le tableau de bord (`DashboardHome.tsx`) bascule une ligue dans la section "Ligues terminées" uniquement quand `league.status === 'completed'`. Or :

- Le bouton `LeagueArchiveButton` (qui appelle `leagues-archive` et passe le statut à `completed`) existe dans le code mais **n'est utilisé nulle part**.
- L'action Super Admin "Archiver" (`SuperAdminLeagueActions.tsx`) passe à `cancelled`, **pas** `completed` → ne range donc pas la ligue dans "Ligues terminées".
- **Aucun mécanisme automatique** ne ferme une ligue `per_course` quand toutes ses courses sont passées.

## Plan d'action

### 1. Correctif immédiat (LIVE) — clore la ligue T1 - Barb+Amstel

Migration SQL ciblée :
```sql
UPDATE leagues
SET status = 'completed',
    archived_at = COALESCE(archived_at, now())
WHERE id = '817b6ae6-f8ae-4ccb-a1ed-1546eadb2f2f';
```
Appliquée en Test puis poussée en LIVE au prochain publish.

### 2. Action manuelle pour le owner / admin de ligue

Brancher le composant `LeagueArchiveButton` (déjà écrit, inutilisé) dans `LeagueSettingsForm.tsx`, visible pour `owner`/`admin` de la ligue, libellé adapté :
- Bouton **"Marquer comme terminée"** → appelle l'edge function `leagues-archive` existante (qui fait `status = 'completed'`).
- Affiché uniquement si `status === 'active'`.
- Confirmation : "La ligue passera dans 'Ligues terminées' du tableau de bord. Réversible par un super-admin."

### 3. Action Super Admin — distinguer "Terminer" et "Annuler"

Dans `SuperAdminLeagueActions.tsx`, ajouter une entrée distincte :
- **"Marquer comme terminée"** → `status = 'completed'` + `archived_at = now()`
- Conserver "Archiver" actuel (`cancelled`) pour les ligues à annuler.
- Conserver "Désarchiver" qui repasse à `active`.

### 4. Automatisation — clore les ligues `per_course` quand toutes les courses sont jouées

Nouvelle fonction SQL + cron quotidien (réutilise le pattern `auto-update-phase-status` mémorisé) :

```sql
CREATE OR REPLACE FUNCTION auto_complete_per_course_leagues()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE leagues l
  SET status = 'completed',
      archived_at = COALESCE(l.archived_at, now())
  WHERE l.status = 'active'
    AND l.game_mode = 'per_course'
    AND EXISTS (
      SELECT 1 FROM league_scopes ls
      WHERE ls.league_id = l.id
        AND ls.selected_course_ids IS NOT NULL
        AND array_length(ls.selected_course_ids, 1) > 0
    )
    AND NOT EXISTS (
      SELECT 1
      FROM league_scopes ls
      JOIN courses c ON c.id = ANY(ls.selected_course_ids)
      WHERE ls.league_id = l.id
        AND (c.date_fin IS NULL OR c.date_fin >= CURRENT_DATE)
    );
END;
$$;

SELECT cron.schedule(
  'auto-complete-per-course-leagues',
  '15 3 * * *',
  $$SELECT public.auto_complete_per_course_leagues();$$
);
```

Logique : pour chaque ligue `per_course` active, si toutes les courses du scope ont une `date_fin < today`, on passe la ligue en `completed`.

Note : pour les modes `five_phases` / `full_season`, on garde la clôture manuelle (la fin de saison est déjà gérée par les phases). On pourra étendre dans un second temps si souhaité.

### 5. (Optionnel) Backfill des autres ligues `per_course`

Lister les ligues actives `per_course` dont toutes les courses sont déjà terminées, et leur appliquer le même UPDATE que pour T1 - Barb+Amstel.

## Détails techniques

- Fichiers modifiés :
  - Nouvelle migration : UPDATE LIVE de la ligue + création de `auto_complete_per_course_leagues()` + cron.
  - `src/components/leagues/LeagueSettingsForm.tsx` : intégration `LeagueArchiveButton`.
  - `src/components/leagues/LeagueArchiveButton.tsx` : ajustement libellé ("Marquer comme terminée").
  - `src/components/admin/leagues/SuperAdminLeagueActions.tsx` : nouvelle entrée "Marquer comme terminée" (`status=completed`).
  - i18n FR/EN si nécessaire.
- Aucun changement côté `DashboardHome.tsx` : la séparation active/terminée fonctionne déjà via `status === 'completed'`.
- Edge function `leagues-archive` déjà conforme (passe à `completed`).

## Validation

1. Après publish : la ligue T1 - Barb+Amstel apparaît dans "Ligues terminées" sur le dashboard LIVE.
2. Le owner d'une ligue voit le bouton "Marquer comme terminée" dans les paramètres de ligue.
3. Le cron tourne chaque nuit et ferme automatiquement les ligues `per_course` dont toutes les courses sont passées.
