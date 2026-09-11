# Abandons pris en compte dans « Mon équipe »

## Problème
Mads Pedersen affiche encore le pictogramme « En course » sur La Vuelta alors qu'il a abandonné (DNS étape 11). Les jours de course comptent aussi la totalité de la course, comme s'il l'avait terminée.

## Comportement attendu
1. **Pictogramme vélo** : un coureur marqué comme abandon (DNF ou DNS) sur une course ne compte plus comme « en course » — l'icône disparaît (et la course n'apparaît plus dans l'infobulle « En course »).
2. **Jours de course** : pour un coureur ayant abandonné, on ne compte que les jours réellement disputés.
   - DNS à l'étape N → N-1 jours (il n'a pas pris le départ de l'étape N)
   - DNF à l'étape N → N jours (il a pris le départ de l'étape N)
   - Le total reste plafonné aux jours déjà écoulés de la course.
   - Course d'un jour avec abandon → 1 jour si DNF, 0 si DNS.
3. Le KPI « Jours de course » en haut de l'onglet Équipes et la colonne « Jours » du tableau reflètent ce nouveau calcul (desktop et mobile).

## Détails techniques
- `supabase/functions/get-team-riders-races/index.ts` : lire `abandon_type` sur `startlist_entries` et exclure les entrées avec `abandon_type` non nul du calcul de `current_races` (les courses à venir restent inchangées).
- `supabase/functions/manager-my-team/index.ts` (bloc de calcul des jours, ~l.157-244) :
  - sélectionner aussi `abandon_type, abandon_etape` dans la requête `startlist_entries` ;
  - charger `course_stage_config (etape_numero, stage_date)` pour les courses concernées afin de convertir le numéro d'étape en date, puis compter les jours entre `date_debut` et la dernière étape disputée ;
  - repli si aucune configuration d'étape : `abandon_etape - 1` (DNS) ou `abandon_etape` (DNF) jours, borné aux jours écoulés ;
  - aucune modification de la logique de points.
- Aucun changement de base de données. Les deux fonctions devront être redéployées.
