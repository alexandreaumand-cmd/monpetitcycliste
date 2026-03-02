

## Nouveau onglet "Hebdo" dans le Classement

Ajout d'un onglet heatmap hebdomadaire dans la section Classement, affichant les points gagnes par semaine pour chaque manager avec un code couleur base sur le classement.

### Architecture

**1. Nouvelle fonction RPC SQL** (`get_weekly_points_heatmap`)
- Parametres : `p_league_id`, `p_saison_id`
- Logique :
  - Joindre `points_ledger` avec `race_results` pour obtenir `date_classement` (date reelle de la course/etape/CG)
  - Joindre avec `rosters` pour attribuer les points aux managers de la ligue
  - Grouper par `manager_id` et `EXTRACT(WEEK FROM date_classement)` (numero de semaine ISO)
  - Retourner : `manager_id`, `manager_nom`, `week_number`, `week_year`, `total_points`
- Filtre par les phases de la saison donnee

**2. Nouveau composant** `src/components/rankings/WeeklyHeatmap.tsx`
- Appelle la RPC via `useQuery`
- Construit une matrice managers x semaines
- Affiche un tableau avec :
  - Colonne fixe a gauche : nom du manager
  - Colonnes : semaines (numero)
  - Cellules : points de la semaine, colorees selon le classement
  - Ligne TOTAL en bas
- Code couleur par semaine (colonne) :
  - Vert fonce (`bg-green-700`) : 1er
  - Vert clair (`bg-green-300`) : 2e et 3e
  - Rouge fonce (`bg-red-600`) : dernier
  - Rouge clair (`bg-red-300`) : avant-dernier et avant-avant-dernier
  - Fond neutre pour les autres
- Scroll horizontal si beaucoup de semaines

**3. Integration dans les pages**
- `Rankings.tsx` (desktop) : ajout d'un 5e onglet "Hebdo" avec `<TabsTrigger value="weekly">`
- `Rankings.mobile.tsx` : ajout dans le `TabGroup` et rendu du composant en mode responsive
- Traductions i18n dans `en/rankings.json` et `fr/rankings.json`

### Details techniques

**Migration SQL** :
```sql
CREATE OR REPLACE FUNCTION public.get_weekly_points_heatmap(
  p_league_id uuid,
  p_saison_id uuid
)
RETURNS TABLE(
  manager_id uuid,
  manager_nom text,
  week_number int,
  total_points numeric
)
LANGUAGE sql STABLE AS $$
  SELECT
    r.manager_id,
    m.nom AS manager_nom,
    EXTRACT(WEEK FROM rr.date_classement)::int AS week_number,
    SUM(pl.points) AS total_points
  FROM points_ledger pl
  JOIN race_results rr
    ON rr.course_id = pl.course_id
    AND rr.coureur_id = pl.coureur_id
    AND rr.type_classement = pl.type_classement
    AND COALESCE(rr.etape_numero, 0) = COALESCE(pl.etape_numero, 0)
  JOIN rosters r
    ON r.coureur_id = pl.coureur_id
    AND r.phase_id = pl.phase_id
    AND r.league_id = p_league_id
  JOIN managers m ON m.id = r.manager_id
  JOIN phases p ON p.id = pl.phase_id
  WHERE p.saison_id = p_saison_id
  GROUP BY r.manager_id, m.nom, EXTRACT(WEEK FROM rr.date_classement)
$$;
```

**Composant WeeklyHeatmap** :
- Recoit `saisonId` en prop
- Transforme les donnees en matrice `{ managers: [...], weeks: [4,5,6,...], cells: Map<managerId_week, points> }`
- Pour chaque semaine, calcule le classement des managers et applique les couleurs
- Affiche la ligne TOTAL (somme par semaine)
- Tri par defaut : par total de points decroissant

