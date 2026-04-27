## Règle métier clarifiée

Le bonus **"First win"** = 1ère victoire **en carrière** d'un coureur (événement unique).
- Doit être **lié à la course de la victoire** (`course_id` rempli).
- Une **seule ligne** dans `bonus_points` (pas une par ligue).
- Une ligue affiche/comptabilise ce bonus **uniquement si la course est dans son scope**.

## État actuel en LIVE (à corriger)

- 16 bonus `first_win` existent, **tous avec `course_id = NULL`** et dupliqués par ligue (ancien modèle).
- Conséquence : ils fuient dans toutes les ligues (cf. Seixas dans COPArdennaises).
- Les autres bonus (`coureur_bonuse`, `ttt`, `scoreurs`) sont des bonus de phase sans course → restent filtrés par `league_id`.

## Plan en 3 étapes

### 1. Code — Filtrage corrigé dans `get-rider-points-table`

Adapter la requête `bonus_points` pour appliquer la bonne règle selon le type :
- Bonus avec `course_id` rempli → doit être dans le scope de la ligue (filtre par scope, **pas** par league_id pour permettre la propagation universelle).
- Bonus avec `course_id = NULL` → bonus de ligue spécifique (rider bonus, ttt, scoreurs) → filtré par `league_id`.

```ts
// Bonus liés à une course : visibles dans toute ligue ayant la course dans son scope
// Bonus sans course : isolés par league_id
const filters: string[] = [];
if (leagueCourseIds && leagueCourseIds.length > 0) {
  filters.push(`course_id.in.(${leagueCourseIds.map(id => `"${id}"`).join(',')})`);
}
if (league_id) {
  filters.push(`and(course_id.is.null,league_id.eq.${league_id})`);
}
if (filters.length > 0) {
  bonusQuery = bonusQuery.or(filters.join(','));
}
```

Cela permet aussi à un bonus first_win sur Amstel d'apparaître automatiquement dans **toutes** les ligues ayant Amstel dans leur scope, sans duplication.

### 2. Données — Migration des bonus first_win existants (toi)

Une fois le code publié, tu corriges manuellement les 16 bonus first_win pour la saison 2026 :
- Garder **une seule ligne** par coureur (supprimer les doublons par ligue).
- Renseigner le `course_id` (course de la victoire).
- Le `league_id` peut être laissé NULL ou conservé — il sera ignoré par le filtre quand `course_id` est rempli.

Je peux te fournir un script de nettoyage/aide si tu le souhaites, mais tu as dit vouloir le faire toi-même.

### 3. Futur — Création des nouveaux bonus first_win

L'interface de création (admin) devra à terme :
- Imposer la sélection d'un `course_id`.
- Créer une **seule ligne** (pas de duplication par ligue).
- Optionnel : `league_id = NULL` (universel, propagé par scope).

→ **Hors scope de cette correction.** À traiter dans un ticket séparé une fois les données nettoyées.

## Fichier modifié dans cette étape

- `supabase/functions/get-rider-points-table/index.ts`

## Impact après publication LIVE (étape 1)

- Tant que les bonus first_win existants ont `course_id = NULL`, ils seront filtrés par `league_id` → **les fuites cessent immédiatement**.
- Une fois les bonus migrés (étape 2 par toi), ils apparaîtront automatiquement dans toutes les ligues éligibles selon le scope.
