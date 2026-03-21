

## Refonte du système de templates de ligues

### Résumé des 2 modes de jeu

**Mode "5 Phases"** — Saison entière ou WT only, 5 phases avec enchères par phase, budget fixe 2200, 30 coureurs, 3-10 managers. Possibilité de démarrer en milieu de saison (seules les phases restantes comptent). Date de début ligue = J+1 après dernier round d'enchères. Les courses par étapes en cours à la date de début ne comptent pas.

**Mode "À la course"** — Le créateur choisit 1+ courses. Enchère unique. Budget et effectif dépendent de la combinaison de courses choisies (8/650, 10/800, 15/1100). 3-10 managers.

---

### 1. Base de données

**Migration — table `league_templates`** :
- Désactiver les 4 templates existants (`short_gt`, `short_wt`, `short_classics`, `full_season`)
- Insérer 2 nouveaux templates :
  - `five_phases` — by_phase=true, budget=2200, max_riders=30, player_counts=[3..10], auction_strategy='per_phase', phase_indexes=[1,2,3,4,5]
  - `per_course` — by_phase=false, budget=650, max_riders=8, player_counts=[3..10], auction_strategy='single', phase_indexes=[]

**Migration — table `leagues`** :
- Ajouter colonne `started_at_effective` (date, nullable) — date de début effective pour le comptage des points (= J+1 après dernier round)
- Ajouter colonne `starting_phase_index` (integer, nullable) — pour savoir à partir de quelle phase la ligue démarre

**Migration — table `league_scopes`** :
- Ajouter colonne `selected_course_ids` (text[], nullable) — liste des courses sélectionnées pour le mode "à la course"

**Migration — table `league_templates`** :
- Mettre à jour le type `game_mode` dans `leagues` pour accepter `five_phases` et `per_course` (en plus des anciens pour rétrocompatibilité)

**Nouvelle table `phase_auction_schedule`** (pour le super-admin) :
- `id` uuid PK
- `phase_id` uuid FK phases
- `auction_opens_at` timestamptz — date de début des enchères pour cette phase (valable pour toutes les ligues)
- `created_at`, `updated_at`
- RLS : SELECT pour tous les authenticated, ALL pour superadmin

---

### 2. Frontend — Flow de création (refonte `CreateLeagueDialog`)

**Étape 1 — Choix du mode** : 2 grosses cartes au lieu de 4 :
- "Mode 5 Phases" — icône Calendar, description courte
- "Mode À la course" — icône Map/Route, description courte

**Étape 2a (5 Phases) — Configuration** :
- Choix variante : "Saison entière" ou "World Tour uniquement" (radio)
- Phase de départ : dropdown auto-calculé selon la date actuelle (les phases passées sont grisées, la phase active est pré-sélectionnée)
- Nombre de managers : slider/radio 3-10
- Nom de la ligue, visibilité, bonuses
- Date de début des enchères (calendrier)
- Badges affichés : Budget 2200, Effectif 30

**Étape 2b (À la course) — Sélection des courses** :
- Liste des courses de la saison filtrables (search + filtres par catégorie/type)
- Multi-select avec chips
- Le budget et l'effectif se recalculent en temps réel selon la logique :
  - 1 one_day → 8/650
  - N one_day → 10/800
  - Toute stage_race → 15/1100
- Nombre de managers : slider/radio 3-10
- Nom de la ligue, visibilité, bonuses
- Date de début des enchères

**Composants impactés** :
- `LeagueTemplateSelector.tsx` — Réécriture complète (2 cartes)
- `LeagueSettingsForm.tsx` — Split en 2 variantes ou conditionnel par mode
- `CreateLeagueDialog.tsx` — Adapter le flow multi-étape
- Nouveau : `CourseSelector.tsx` — composant de sélection multi-courses

---

### 3. Edge function `leagues-create`

Adapter pour :
- Accepter le nouveau `game_mode` (`five_phases` / `per_course`)
- Pour `five_phases` : calculer les phases à inclure en fonction de `starting_phase_index`, stocker `starting_phase_index` sur la ligue
- Pour `per_course` : stocker `selected_course_ids` dans `league_scopes`, calculer budget/effectif côté serveur
- Ne plus dépendre des templates DB pour le budget (valeurs fixes)
- Créer les enchères correctement : per_phase pour 5 phases (seule la première phase a une date, les suivantes via `phase_auction_schedule`), single pour à la course

---

### 4. Écran super-admin : planning des enchères par phase

Nouveau composant dans l'admin : **`PhaseAuctionSchedule`**
- Tableau des 5 phases de la saison en cours
- Pour chaque phase : date picker pour fixer `auction_opens_at`
- Cette date s'applique à toutes les ligues en mode 5 phases
- Table `phase_auction_schedule` alimentée par cet écran

---

### 5. Templates & types TypeScript

- `src/lib/leagues/types.ts` — Mettre à jour `GameMode` : `'five_phases' | 'per_course'`
- `src/lib/leagues/templates.ts` — Simplifier, 2 templates statiques + logique de calcul budget/effectif pour `per_course`

---

### 6. Traductions i18n

Nouvelles clés dans `leagues.json` (fr + en) :
- `templates.fivePhases.name/description`
- `templates.perCourse.name/description`
- `settings.variant` (Saison entière / WT)
- `settings.startingPhase`
- `settings.selectCourses`
- `settings.courseCount`
- Labels pour l'écran admin planning enchères

---

### Fichiers impactés

| Fichier | Action |
|---------|--------|
| `src/lib/leagues/types.ts` | Modifier GameMode |
| `src/lib/leagues/templates.ts` | Réécriture |
| `src/components/leagues/LeagueTemplateSelector.tsx` | Réécriture |
| `src/components/leagues/LeagueSettingsForm.tsx` | Refonte majeure |
| `src/components/leagues/CreateLeagueDialog.tsx` | Adapter flow |
| `src/components/leagues/CourseSelector.tsx` | **Nouveau** |
| `supabase/functions/leagues-create/index.ts` | Refonte majeure |
| `src/i18n/locales/fr/leagues.json` | Nouvelles clés |
| `src/i18n/locales/en/leagues.json` | Nouvelles clés |
| `src/components/admin/PhaseAuctionSchedule.tsx` | **Nouveau** |
| Migration SQL | Templates + colonnes + nouvelle table |

