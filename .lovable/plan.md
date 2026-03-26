

## Corriger l'affichage des bonus manager dans l'écran super-admin

### Problème
Les bonus existent en base (ex: Manou / MPC 2026 / Phase 1 → 200 pts scoreurs) mais ne s'affichent pas dans l'onglet "Bonus Manager" du super-admin.

### Cause racine
La requête dans `ManagerBonusTab.tsx` (ligne 159) utilise le join :
```
league:leagues!fk_manager_bonus_points_league(id, name)
```
Or la contrainte FK `fk_manager_bonus_points_league` **n'existe pas** sur la table `manager_bonus_points`. La colonne `league_id` existe mais n'a pas de foreign key vers `leagues`. PostgREST ne peut pas résoudre ce join → la requête échoue silencieusement ou renvoie des résultats vides.

### Solution
1. **Migration SQL** : Ajouter la FK manquante sur `manager_bonus_points.league_id → leagues.id` avec le nom `fk_manager_bonus_points_league`
2. Aucun changement frontend nécessaire — le join existant fonctionnera dès que la FK est créée

### Migration
```sql
ALTER TABLE public.manager_bonus_points
ADD CONSTRAINT fk_manager_bonus_points_league
FOREIGN KEY (league_id) REFERENCES public.leagues(id);
```

### Résultat attendu
- L'onglet "Bonus Manager" affiche correctement les bonus attribués (Manou → 200 pts scoreurs dans MPC 2026)
- Le nom de la ligue apparaît dans la colonne "Ligue"

### Fichier impacté
- 1 migration SQL uniquement

