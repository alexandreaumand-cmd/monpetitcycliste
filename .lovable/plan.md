# Afficher les phases par manager dans le Top Coureurs

## Objectif
Dans la colonne « Managers » du classement Top Coureurs, indiquer pour chaque manager les phases pendant lesquelles il possédait le coureur, y compris quand il l'a eu sur plusieurs phases (ex. `Matt B · P1, P3`).

## Comportement
- Vue « Global » (aucune phase sélectionnée) : chaque badge manager affiche la liste compacte de ses phases, triées par ordre croissant (`P1, P2, P4`). Phases consécutives affichées telles quelles, séparées par des virgules.
- Vue « Phase X » : inchangée (une seule phase, l'information serait redondante).
- Si un coureur n'a aucune phase connue pour un manager, on garde le badge nom seul.
- Même logique appliquée à la version mobile du Top Coureurs si elle affiche les managers.

## Détails techniques
- La fonction `get-top-riders` renvoie déjà `owners_by_phase` (dictionnaire `{"P1": [{manager_id, manager_nom, phase_index}], ...}`) en mode global — aucune modification backend nécessaire.
- Dans `src/components/rankings/TopRiders.tsx` : construire un memo `phasesByManager` par coureur à partir de `owners_by_phase` (map `manager_id -> phase_index[]` dédupliqué et trié), puis afficher dans le badge de la colonne Managers le nom suivi des phases.
- Le badge reste compact : nom en normal, suffixe phases en `text-muted-foreground text-[10px]`.
- Vérifier la variante mobile (`src/components/rankings/` / `Rankings.mobile`) et appliquer le même rendu si la colonne managers y existe.
