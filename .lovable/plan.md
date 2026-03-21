

## Fix: Contrainte `valid_game_mode` bloque les nouveaux modes

### Problème
La contrainte `valid_game_mode` sur la table `leagues` n'accepte que les anciens modes (`full_season`, `short_gt`, `short_wt`, `short_classics`). Les nouveaux modes `five_phases` et `per_course` n'ont jamais été ajoutés — la migration précédente a oublié de mettre à jour cette contrainte.

### Correction

**Migration SQL unique** :
```sql
ALTER TABLE public.leagues DROP CONSTRAINT valid_game_mode;
ALTER TABLE public.leagues ADD CONSTRAINT valid_game_mode 
  CHECK (game_mode = ANY (ARRAY[
    'full_season', 'short_gt', 'short_wt', 'short_classics',
    'five_phases', 'per_course'
  ]));
```

Cela conserve les anciens modes pour la rétrocompatibilité et ajoute les deux nouveaux.

### Fichier impacté
| Fichier | Action |
|---------|--------|
| Migration SQL | Drop + recreate constraint |

