
## Ajout "Nombre de jours de course" dans l'ecran equipe

### Vue d'ensemble

Ajouter le nombre de jours de course par coureur (colonne dans le tableau) et le cumul total (stat dans le bandeau KPI), en se basant sur les startlists des courses passees.

### Logique de calcul

Pour chaque coureur visible de l'equipe :
1. Recuperer toutes les courses passees (`date_fin < today`) de la phase
2. Pour chaque course, trouver le dernier `startlist_imports` (par `race_id`, `MAX(created_at)`)
3. Verifier si le coureur est present dans `startlist_entries` pour ce startlist_id
4. Calculer `date_fin - date_debut + 1` comme nombre de jours
5. Sommer par coureur

### Fichiers a modifier

| Fichier | Modification |
|---------|-------------|
| `supabase/functions/manager-my-team/index.ts` | Calculer `race_days` par coureur et `total_race_days` dans les KPIs |
| `src/components/team/MyTeam.desktop.tsx` | Colonne "Jours" triable dans le tableau + stat dans le bandeau KPI (5 colonnes) |
| `src/components/team/MyTeam.mobile.tsx` | Stat cumul jours dans le bandeau KPI mobile |
| `src/i18n/locales/fr/team.json` | Ajouter `raceDays`, `totalRaceDays`, `table.raceDays`, `sort.jours` |
| `src/i18n/locales/en/team.json` | Ajouter les memes cles en anglais |

### Details techniques

**Edge function `manager-my-team/index.ts`** :

Apres la ligne 133 (visibleCoureurs), inserer le bloc de calcul des jours de course :
- Requeter `courses` avec `date_fin < today` et filtrer par `phase_id` si fourni
- Pour chaque course passee, trouver le dernier `startlist_imports` par `race_id` (`ORDER BY created_at DESC`, garder le premier par race)
- Requeter `startlist_entries` avec les `startlist_id` trouves et les `coureur_id` de l'equipe
- Calculer le nombre de jours par course : `(date_fin - date_debut) / 86400000 + 1`
- Creer une Map coureur_id -> total_race_days
- Attacher `race_days` a chaque coureur visible
- Ajouter `total_race_days` (somme) dans les KPIs retournes (ligne 270)

**Desktop `MyTeam.desktop.tsx`** :

- Ligne 7 : ajouter `Calendar` dans les imports lucide
- Ligne 37-46 : ajouter `race_days?: number` a l'interface `Coureur`
- Ligne 57-66 : ajouter `total_race_days: number` a l'interface `TeamKPIs`
- Ligne 69 : ajouter `'jours'` au type `SortBy`
- Lignes 389-414 : ajouter un case `'jours'` dans le switch de tri : `comparison = (b.race_days || 0) - (a.race_days || 0)`
- Ligne 648 : changer `grid-cols-4` en `grid-cols-5`
- Apres la cellule Scoreurs (ligne 668), ajouter une nouvelle cellule KPI :
  - Icone Calendar bleu
  - Valeur `kpis.total_race_days`
  - Label "Jours" ou traduction `raceDays`
- Apres la colonne "Points totaux" (ligne 734), ajouter une nouvelle colonne "Jours" triable avec `handleSort('jours')`
- Dans le TableBody (ligne 795), ajouter une cellule affichant `coureur.race_days || 0`

**Mobile `MyTeam.mobile.tsx`** :

- Ligne 20-30 : ajouter `Calendar` dans les imports lucide
- Ligne 96-102 : ajouter `total_race_days: 0` dans le state initial des KPIs
- Ligne 425-444 : dans la barre de stats compactes, ajouter un element apres scoreurs :
  - Icone Calendar
  - Valeur `kpis.total_race_days`
  - Label "jours"

**Traductions FR `team.json`** :

Ajouter :
- `"raceDays": "Jours de course"`
- `"totalRaceDays": "Jours de course"`
- dans `table` : `"raceDays": "Jours"`
- dans `sort` : `"jours": "Jours"`

**Traductions EN `team.json`** :

Ajouter :
- `"raceDays": "Race days"`
- `"totalRaceDays": "Race days"`
- dans `table` : `"raceDays": "Days"`
- dans `sort` : `"jours": "Days"`
