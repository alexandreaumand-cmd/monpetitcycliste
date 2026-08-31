# Mouvements startlists : regrouper par date puis par course

## Objectif
Rendre le bloc « Mouvements startlists » plus lisible en ajoutant un niveau supérieur « Date » : on voit d'abord les jours de détection, puis à l'intérieur les courses, puis les mouvements.

## Comportement attendu

```text
Mouvements startlists
  lundi 31 août 2026            (12)      <- accordéon niveau 1, ouvert par défaut
     ZLM Tour            (28)             <- accordéon niveau 2
        + / - coureur, équipe, manager, heure
     Tour of Istanbul     (7)
  dimanche 30 août 2026         (43)
     Lloyds Tour of Britain Men (105)
     ...
```

- Niveau 1 : date de **détection** du mouvement (`detected_at`, fuseau local), la plus récente en haut. Libellé long en français, avec « Aujourd'hui » / « Hier » pour les deux dernières journées.
- Le premier groupe de dates est ouvert par défaut, les autres fermés.
- Badge de comptage sur chaque date (nombre total de mouvements du jour) et sur chaque course (comme aujourd'hui).
- Niveau 2 : les courses de cette journée, triées comme actuellement (ordre chronologique des courses de la phase).
- Contenu inchangé : tableau desktop (Type / Coureur / Équipe / Manager / Détecté) et cartes mobile, avec les mêmes surlignages (mes coureurs en doré, coureurs d'un autre manager en bleu).
- La colonne/heure « Détecté » n'affiche plus que l'heure (HH:mm) puisque la date est portée par le groupe.

## Détails techniques
- Un seul fichier touché : `src/components/startlist/StartlistTrackerMovements.tsx`.
- Remplacer `groupedByCourse` par un `groupedByDateThenCourse` : clé date = `detected_at` tronqué au jour local, tri décroissant ; à l'intérieur, regroupement par `course_id` avec le tri `courseOrder` existant.
- Accordéons imbriqués (`Accordion type="multiple"` déjà utilisé), l'accordéon interne conserve les valeurs `courseId`.
- Aucun changement de requête, de schéma ou de fonction backend.
