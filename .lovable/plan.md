

## Probleme

La vue `v_course_points_theoriques` en production ne reconnait pas `type_course = 'etapes'` (sans accent) comme une course par etapes. Elle ne teste que `%stage%` et `%étape%` (avec accent).

Resultat : l'UAE Tour (type_course = 'etapes') affiche `nb_etapes_estimees = 1` au lieu de 6, donc `points_etapes = 940` au lieu de `5640`, et `points_total = 3915` au lieu de `8615`.

## Correction

### Migration SQL

Recreer la vue `v_course_points_theoriques` en ajoutant `OR c.type_course ~~* '%etape%'` (sans accent) dans le CASE de `nb_etapes_estimees` :

```sql
CASE
  WHEN c.categorie ~~* '%WT GT%' THEN 21
  WHEN c.type_course ~~* '%stage%'
    OR c.type_course ~~* '%étape%'
    OR c.type_course ~~* '%etape%'   -- AJOUT
  THEN ...
```

La migration recree la vue complete avec cette seule modification. Aucun changement frontend necessaire.

### Deploiement

Apres la migration (environnement Test), il faudra publier l'application pour que le fix s'applique en production.

