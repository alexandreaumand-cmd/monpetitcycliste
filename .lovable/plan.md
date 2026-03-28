

## Fix : la ligue "TEST Ligue P3 sans bonus" affiche des courses hors scope (phases 1-2)

### Cause racine

Cette ligue a été créée **avant** le fix de `leagues-create`. En conséquence :
- `starting_phase_index` est `NULL` en base
- `scope.phases` contient les 5 phases (1 à 5) au lieu de seulement 3, 4, 5

Le filtre SQL dans `get_league_course_ids` vérifie `starting_phase_index`, mais comme il est `NULL`, il ne filtre rien → toutes les courses des 5 phases sont retournées.

### Solution

**Migration SQL** pour corriger les données existantes de cette ligue (et toute autre ligue dans le même cas) :

1. **Mettre à jour `starting_phase_index`** pour les ligues qui ont été créées avec un starting phase > 1 mais dont le champ est resté `NULL`. On peut identifier ces ligues par leur nom ou manuellement.

2. **Nettoyer `scope.phases`** pour retirer les phases antérieures au `starting_phase_index`.

Concrètement pour "TEST Ligue P3 sans bonus" (id: `ed007344-2243-4553-94ae-10028086bcd8`) :

```sql
-- Fix starting_phase_index
UPDATE leagues 
SET starting_phase_index = 3 
WHERE id = 'ed007344-2243-4553-94ae-10028086bcd8';

-- Fix scope.phases : ne garder que les phases 3, 4, 5
UPDATE league_scopes 
SET phases = ARRAY(
  SELECT p.id FROM phases p 
  WHERE p.id = ANY(phases) 
  AND p.index_dans_saison >= 3
  ORDER BY p.index_dans_saison
)
WHERE league_id = 'ed007344-2243-4553-94ae-10028086bcd8';
```

Cela réaligne les données avec ce que le fix `leagues-create` aurait produit si la ligue avait été créée après le correctif.

### Fichier impacté
- Migration SQL — correction des données pour la ligue existante

