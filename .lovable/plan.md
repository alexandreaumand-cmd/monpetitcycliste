

# Fix: Gestion des doublons de code_court dans CreateEquipeDialog

## Problème

`CreateEquipeDialog.tsx` ligne 52-59 fait un `INSERT` dans `equipes` sans vérifier si le `code_court` existe déjà. Si l'équipe "TCC" existe déjà dans `equipes` (mais pas dans `equipes_saisons` pour cette saison), le flow échoue au lieu de réutiliser l'équipe existante.

## Solution

Modifier la mutation dans `CreateEquipeDialog.tsx` :

1. **Avant l'INSERT**, faire un `SELECT` sur `equipes` filtré par `code_court`
2. **Si l'équipe existe** → réutiliser son `id`, mettre à jour `nom_complet` et `pays` si besoin
3. **Si elle n'existe pas** → `INSERT` comme aujourd'hui
4. Ensuite créer l'entrée `equipes_saisons` normalement
5. Ajouter aussi une vérification que l'entrée `equipes_saisons` n'existe pas déjà (même équipe + même saison)

Appliquer la même logique dans `CreateTeamDialog.tsx` (utilisé lors de l'import startlist).

### Fichiers modifiés
- `src/components/admin/equipes/CreateEquipeDialog.tsx`
- `src/components/admin/startlist-data/CreateTeamDialog.tsx`

