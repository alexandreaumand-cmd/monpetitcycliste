

# Fix : Lisibilité du classement Général (Finaux) sur mobile

## Diagnostic
Dans `CourseResultsDrawer.tsx` (lignes 619-675), le rendu du tableau "Finaux > Général" utilise une densité extrême :
- `text-[10px]` sur la table, `text-[8px]` sur l'équipe et le manager
- `px-1 py-0 leading-none` (aucun padding vertical, aucune respiration)
- 4 colonnes très étroites (`w-6`, `w-7`, `w-14`)

Résultat (cf. capture) : texte minuscule, lignes collées, équipe écrasée — illisible sur mobile.

À noter : le tableau "Total riders" juste au-dessus (lignes 524-613) et `TTTResultsTable` utilisent une typographie normale. Seul ce tableau "régulier" est sur-condensé.

## Correction proposée

Aligner le tableau régulier sur les standards mobile du projet (cf. mémoire `style/mobile/data-density-optimizations`) tout en gardant un layout 4 colonnes :

| Élément | Avant | Après |
|---|---|---|
| Table | `text-[10px] table-fixed` | `text-xs` |
| Cellules | `px-1 py-0 leading-none` | `px-2 py-1.5` |
| Nom coureur | `font-semibold truncate` (text-[10px]) | `text-sm font-semibold truncate` |
| Équipe | `text-[8px]` inline derrière le nom | `text-[10px] text-muted-foreground` placé sur une **2ème ligne** sous le nom (block, truncate) |
| Position | `w-6` | `w-8` |
| Points | `w-7` | `w-10`, `text-sm font-bold` |
| Manager | `w-14 text-[8px]` | `w-16 text-[10px]` (Badge `secondary` plus lisible) |
| Statut badge | `text-[7px]` slice(0,3) | `text-[10px]` label complet abrégé (DNF/DNS/DSQ) |

### Structure de la cellule "Coureur" (changement clé)
```tsx
<div className="flex flex-col min-w-0">
  <span className="text-sm font-semibold truncate">{row.coureur_nom}</span>
  <span className="text-[10px] text-muted-foreground truncate">{row.equipe}</span>
</div>
```

### Highlight "mon coureur"
Conserver le bandeau jaune mais étendre légèrement (`border-l-4` au lieu de `border-l-2`) pour rester visible avec la nouvelle hauteur.

## Portée
- Modifications limitées au bloc `// Regular results table` (lignes 618-676).
- Aucun impact sur TTT, Total, Étapes, Maillots — déjà corrects.
- Visible uniquement sur mobile (le drawer mobile utilise déjà ce composant).

## Fichiers modifiés
1. `src/components/courses/CourseResultsDrawer.tsx` — refonte du rendu du tableau régulier (Finaux + Étapes utilisent le même bloc s'il est partagé ; à vérifier puis appliquer aussi).

