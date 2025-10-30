# League Templates - Guide Complet

Ce document explique le système de templates de ligues et comment il gère les phases, les enchères et les filtres de courses.

## Vue d'ensemble

Le système de templates permet de créer différents types de ligues avec des configurations spécifiques pour :
- Les phases concernées (par index: 1-5)
- La stratégie d'enchères (unique, par phase, groupée)
- Les filtres de courses (GT, WT, Monuments, etc.)
- Les paramètres de budget et roster

## Structure d'un Template

### Champs principaux

```typescript
{
  id: string;                           // Identifiant unique (ex: 'short_gt')
  name: string;                         // Nom affiché
  description: string;                  // Description
  player_counts: number[];              // Tailles de ligues autorisées [4, 6, 8, 10]
  base_budget: number;                  // Budget de base (4 joueurs)
  base_max_riders: number;              // Nombre max de coureurs (4 joueurs)
  budget_multiplier_per_player: number; // Multiplicateur par joueur additionnel
  riders_multiplier_per_player: number; // Multiplicateur coureurs par joueur
  phase_indexes: number[];              // Index des phases concernées [1,2,3,4,5]
  auction_strategy: string;             // 'single' | 'per_phase' | 'grouped'
  auction_phase_groups?: number[][];    // Groupes pour stratégie 'grouped'
  course_filters: CourseFilters;        // Filtres de courses
}
```

### Course Filters

```typescript
{
  wt_tier?: string[];           // Types WT: ['GT', 'WT', 'ProSeries']
  categorie?: string[];         // Catégories UCI spécifiques
  competitions?: string[];      // Noms exacts de courses
  exclude_proseries?: boolean;  // Exclure les ProSeries
}
```

## Stratégies d'Enchères

### 1. Single ('single')
Une seule enchère pour toute la durée du mode de jeu.
- Le roster est reconduit automatiquement d'une phase à l'autre
- Idéal pour des ligues courtes et cohérentes (ex: Grands Tours)
- Une seule enchère créée pour la première phase du template

**Exemple: `short_gt`**
```json
{
  "phase_indexes": [3, 4],
  "auction_strategy": "single",
  "course_filters": {
    "wt_tier": ["GT"]
  }
}
```
→ Une enchère unique au début de la phase 3, roster reconduit en phase 4

### 2. Per Phase ('per_phase')
Une enchère à chaque nouvelle phase.
- Le roster est réinitialisé à chaque phase
- Permet de reconstruire son équipe régulièrement
- Une enchère créée par phase incluse dans le template

**Exemple: `full_season`**
```json
{
  "phase_indexes": [1, 2, 3, 4, 5],
  "auction_strategy": "per_phase",
  "course_filters": {}
}
```
→ 5 enchères créées (une par phase), reset complet à chaque fois

### 3. Grouped ('grouped')
Une enchère par groupe de phases.
- Le roster est reconduit au sein d'un même groupe
- Permet des "mini-saisons" cohérentes
- Nécessite de définir `auction_phase_groups`

**Exemple: Printemps/Été/Automne**
```json
{
  "phase_indexes": [1, 2, 3, 4, 5],
  "auction_strategy": "grouped",
  "auction_phase_groups": [[1, 2], [3, 4], [5]],
  "course_filters": {}
}
```
→ 3 enchères:
- Groupe 1 (phases 1-2): enchère au début de phase 1, roster reconduit en phase 2
- Groupe 2 (phases 3-4): enchère au début de phase 3, roster reconduit en phase 4
- Groupe 3 (phase 5): enchère au début de phase 5

## Templates Pré-configurés

### 1. Full Season (full_season)
```json
{
  "phase_indexes": [1, 2, 3, 4, 5],
  "auction_strategy": "per_phase",
  "course_filters": {}
}
```
- Toutes les phases
- Enchère à chaque phase
- Toutes les courses

### 2. Short GT (short_gt)
```json
{
  "phase_indexes": [3, 4],
  "auction_strategy": "single",
  "course_filters": {
    "wt_tier": ["GT"]
  }
}
```
- Phases 3 et 4 (périodes des Grands Tours)
- Une seule enchère
- Uniquement les GT (Tour, Giro, Vuelta)

### 3. Short WT (short_wt)
```json
{
  "phase_indexes": [1, 2, 3, 4, 5],
  "auction_strategy": "per_phase",
  "course_filters": {
    "exclude_proseries": true
  }
}
```
- Toutes les phases
- Enchère par phase
- Toutes les courses WT (exclut ProSeries)

### 4. Short Classics (short_classics)
```json
{
  "phase_indexes": [1, 2],
  "auction_strategy": "single",
  "course_filters": {
    "competitions": [
      "Milano-Sanremo",
      "Ronde van Vlaanderen",
      "Paris-Roubaix",
      "Liège-Bastogne-Liège",
      "Il Lombardia",
      "Strade Bianche",
      "Amstel Gold Race",
      "La Flèche Wallonne"
    ]
  }
}
```
- Phases 1 et 2 (printemps + automne)
- Une seule enchère
- Uniquement les Monuments et classiques majeures

## Exemples de Course Filters

### Filtrer par WT Tier
```json
{
  "wt_tier": ["GT"]          // Uniquement Grands Tours
  "wt_tier": ["WT"]          // Uniquement World Tour (hors GT et ProSeries)
  "wt_tier": ["GT", "WT"]    // GT + WT (exclut ProSeries)
}
```

### Exclure ProSeries
```json
{
  "exclude_proseries": true
}
```

### Liste spécifique de courses
```json
{
  "competitions": [
    "Tour de France",
    "Milano-Sanremo",
    "Paris-Roubaix"
  ]
}
```

### Combinaison
```json
{
  "wt_tier": ["GT", "WT"],
  "exclude_proseries": true,
  "competitions": [
    "Milano-Sanremo",
    "Paris-Roubaix"
  ]
}
```
→ GT + WT mais pas ProSeries, ET uniquement Milano-Sanremo et Paris-Roubaix

## Calcul du Budget et Max Riders

Le budget et le nombre max de coureurs sont calculés selon le nombre de joueurs :

```
Budget = base_budget × (1 + (nb_players - 4) × budget_multiplier_per_player)
MaxRiders = base_max_riders × (1 + (nb_players - 4) × riders_multiplier_per_player)
```

**Exemple avec `full_season` (4→10 joueurs):**
- Budget de base: 2200
- Multiplicateur: 0.15
- Pour 10 joueurs: `2200 × (1 + (10-4) × 0.15) = 2200 × 1.9 = 4180`

## Créer un Nouveau Template

### Via l'interface SuperAdmin

1. Aller dans **Gestion des ligues > Templates**
2. Cliquer sur **Créer un template**
3. Remplir les champs :
   - **ID**: Identifiant unique (ex: `short_spring`)
   - **Nom & Description**: Textes affichés
   - **Nombre de joueurs**: Cocher les tailles autorisées
   - **Budget & Coureurs**: Définir base + multiplicateurs
   - **Phases concernées**: Cocher les phases (1-5)
   - **Stratégie d'enchères**: Choisir single/per_phase/grouped
   - **Groupes de phases**: Si strategy = grouped
   - **Filtres de courses**: Cocher WT Tier, exclure ProSeries, lister competitions

### Via SQL

```sql
INSERT INTO league_templates (
  id, name, description,
  player_counts,
  base_budget, base_max_riders,
  budget_multiplier_per_player, riders_multiplier_per_player,
  phase_indexes,
  auction_strategy,
  auction_phase_groups,
  course_filters,
  is_active
) VALUES (
  'my_custom_mode',
  'Mon Mode Personnalisé',
  'Description de mon mode',
  ARRAY[4, 6, 8],
  1500,
  20,
  0.15,
  0.10,
  ARRAY[1, 2],
  'grouped',
  ARRAY[[1], [2]],
  '{"competitions": ["Milano-Sanremo", "Paris-Roubaix"]}'::jsonb,
  true
);
```

## Fonctionnement Technique

### Création d'une Ligue

1. L'utilisateur choisit un template
2. Le système récupère les phases réelles depuis la DB basées sur `phase_indexes` et `season_id`
3. Les enchères sont créées selon la `auction_strategy`
4. Le `league_scope` est créé avec les UUIDs de phases et les `course_filters`

### Fonction Helper: `get_league_course_ids`

Cette fonction SQL retourne les IDs des courses autorisées pour une ligue :

```sql
SELECT * FROM get_league_course_ids('league-uuid');
```

Elle applique automatiquement :
- Le filtre de phases (via `league_scopes.phases`)
- Les filtres de courses (via `league_scopes.course_filters`)

### Utilisation dans les Queries

```sql
-- Exemple: Récupérer les résultats récents d'une ligue
SELECT *
FROM results_recent_races(p_league_id := 'uuid')
WHERE course_id IN (
  SELECT course_id FROM get_league_course_ids('uuid')
);
```

## Contraintes et Validations

### Base de données

- `phase_indexes` ne peut pas être vide
- `auction_strategy` doit être 'single', 'per_phase' ou 'grouped'
- Si `auction_strategy = 'grouped'`, `auction_phase_groups` est obligatoire
- Les groupes de phases doivent couvrir tous les `phase_indexes`

### Interface

- Au moins une phase doit être sélectionnée
- Au moins un nombre de joueurs doit être autorisé
- Budget et max_riders doivent être > 0
- Les multiplicateurs doivent être >= 0

## Migration des Données Existantes

Les templates existants ont été automatiquement migrés avec ces valeurs par défaut :

```sql
-- full_season
phase_indexes: [1,2,3,4,5]
auction_strategy: 'per_phase'
course_filters: {}

-- short_gt
phase_indexes: [3,4]
auction_strategy: 'single'
course_filters: {"wt_tier": ["GT"]}

-- short_wt
phase_indexes: [1,2,3,4,5]
auction_strategy: 'per_phase'
course_filters: {"exclude_proseries": true}

-- short_classics
phase_indexes: [1,2]
auction_strategy: 'single'
course_filters: {"competitions": [...]}
```

## Troubleshooting

### Aucune course n'apparaît dans la ligue

**Vérifier:**
1. Les phases sont-elles bien définies pour la saison active ?
2. Les `course_filters` ne sont-ils pas trop restrictifs ?
3. Y a-t-il des courses dans les phases sélectionnées ?

**Debug:**
```sql
-- Vérifier le scope
SELECT * FROM league_scopes WHERE league_id = 'uuid';

-- Vérifier les courses autorisées
SELECT * FROM get_league_course_ids('uuid');

-- Vérifier les courses dans les phases
SELECT * FROM courses WHERE phase_id = ANY(
  SELECT unnest(phases) FROM league_scopes WHERE league_id = 'uuid'
);
```

### Les enchères ne se créent pas

**Vérifier:**
1. La stratégie d'enchères est-elle valide ?
2. Si 'grouped', les groupes de phases sont-ils bien définis ?
3. Les phases existent-elles dans la saison ?

**Debug:**
```sql
-- Vérifier les enchères créées
SELECT * FROM auctions WHERE league_id = 'uuid' ORDER BY phase_id;

-- Vérifier le template
SELECT auction_strategy, auction_phase_groups 
FROM league_templates 
WHERE id = 'template_id';
```

## Bonnes Pratiques

1. **Nommer clairement** : Utilisez des IDs et noms explicites
2. **Tester** : Créez une ligue test avant de publier un template
3. **Documenter** : Ajoutez une description détaillée
4. **Valider les filtres** : Vérifiez que les filtres retournent bien les courses attendues
5. **Groupes cohérents** : Pour strategy 'grouped', groupez des phases logiquement liées
6. **Budget adapté** : Ajustez le budget selon la difficulté et la durée du mode

## Support

Pour toute question ou problème, consulter :
- Ce document (`LEAGUE_TEMPLATES.md`)
- Le code source dans `src/lib/leagues/templates.ts`
- L'interface superadmin pour tester les templates
- Les logs des edge functions `leagues-create` et `ouvrir-nouveau-round`
