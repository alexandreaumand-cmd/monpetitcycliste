## Objectif

Rétablir le calcul des "Mouvements du jour" basé sur la **date réelle de course** (`date_classement`), tout en corrigeant le problème de fond : aujourd'hui toutes les étapes d'un grand tour partagent la même date (`course.date_fin`), et rien ne permet de gérer les **jours de repos**. On va donc introduire une date par étape, éditable depuis le superadmin.

## Ce qu'on change

### 1. Stocker une date par étape

On ajoute une colonne `stage_date date` à la table existante `course_stage_config` (déjà clé `course_id + etape_numero`, déjà utilisée pour le CLM par équipes). Pas de nouvelle table.

- Migration : `ALTER TABLE course_stage_config ADD COLUMN stage_date date;`
- Backfill par défaut : pour chaque (course, étape) connu via `race_results`, on initialise `stage_date = course.date_debut + (etape_numero - 1)` (logique linéaire actuelle, sans repos). L'admin pourra ensuite corriger les jours de repos manuellement.
- Aucune contrainte NOT NULL (rétrocompatibilité) — l'écriture des résultats utilisera un fallback.

### 2. Utiliser cette date à l'écriture des résultats

Dans les edge functions qui posent `date_classement` sur `race_results` et `points_ledger` :

- `supabase/functions/admin-stage-save-step/index.ts`
- `supabase/functions/admin-gc-save/index.ts`

Nouvelle règle de résolution (dans cet ordre) :
1. `course_stage_config.stage_date` pour `(course_id, etape_numero)` si défini
2. sinon `course.date_debut + (etape_numero - 1) jours` quand `etape_numero` est défini
3. sinon `course.date_fin` (cas classement général / course d'un jour)
4. sinon `now()`

Aucune réécriture rétroactive des `race_results` existants dans cette étape ; un bouton "Recalculer les dates" pourra être ajouté plus tard si besoin.

### 3. UI superadmin : éditer les dates d'étapes

Nouveau petit éditeur "Dates des étapes" dans la page détail course superadmin (`src/pages/admin/`), accessible depuis le studio de saisie des résultats existant.

- Liste les étapes de 1 à N (N = max `etape_numero` connu dans `race_results` ou paramétrable)
- Une ligne par étape : numéro + date picker
- Bouton "Pré-remplir depuis date_debut" (linéaire) et bouton "Marquer jour de repos" qui décale toutes les étapes suivantes de +1 jour
- Sauvegarde en upsert sur `course_stage_config (course_id, etape_numero, stage_date)`
- Visible également en mobile via un bottom sheet simple

### 4. Recalcul des points journaliers sur la vraie date

Migration qui remet `get_daily_points_by_manager` et `get_weekly_top_riders` à filtrer sur `rr.date_classement`, **en gardant** le filtre `league_scopes.selected_course_ids` ajouté par la migration `20260514202010` :

```sql
WHERE rr.date_classement >= p_start::date
  AND rr.date_classement <= p_end::date
  AND ( s.selected_course_ids IS NULL
        OR array_length(s.selected_course_ids, 1) IS NULL
        OR pl.course_id = ANY(s.selected_course_ids) )
```

Conséquences :
- Plus de pollution de "Mouvements du jour" quand on rescanne des résultats anciens.
- À condition que les `date_classement` soient à jour. Pour les étapes saisies avant ce changement, on aura encore `date_fin` partout — d'où l'utilité de l'éditeur (re-saisir une étape rejouera la date, ou on ajoute plus tard un bouton de recalcul global).

## Hors scope (à confirmer ensuite)

- Recalcul rétroactif des `date_classement` déjà stockés (utile pour le Giro en cours ?).
- Affichage des jours de repos dans le calendrier public.

## Détails techniques

- Migration SQL en deux temps : (a) ajout colonne + redéfinition des deux fonctions SQL, (b) data-fix optionnel via tool `insert` pour pré-remplir `stage_date` à partir de `date_debut + (etape_numero - 1)` pour les courses par étapes déjà connues.
- Les edge functions lisent `course_stage_config` qui est déjà chargée pour la config TTT : un seul `select` supplémentaire de `stage_date` au même endroit, pas de round-trip en plus.
- Types Supabase régénérés automatiquement après migration ; aucune édition manuelle de `src/integrations/supabase/types.ts`.

## Question avant de coder

Souhaites-tu aussi un bouton "Recalculer toutes les `date_classement` de cette course à partir des `stage_date`" pour corriger l'historique du Giro en cours, ou on se contente de la règle pour les futures saisies ?
