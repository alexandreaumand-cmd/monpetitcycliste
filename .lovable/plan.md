# Tracking plus frequent pour les courses imminentes

## Contexte actuel

Le startlist tracker utilise un intervalle unique de **6 heures** (`RECHECK_INTERVAL_HOURS = 6`) pour toutes les courses, quelle que soit leur proximite temporelle. Une course prevue demain est re-verifiee au meme rythme qu'une course dans 2 mois.

## Modification proposee

Introduire un intervalle de re-check **adaptatif** selon la proximite de la course :


| Proximite                  | Intervalle actuel | Nouvel intervalle |
| -------------------------- | ----------------- | ----------------- |
| Aujourd'hui ou demain      | 6h                | **30min**         |
| Dans les 7 prochains jours | 6h                | 30min             |
| Au-dela de 7 jours         | 6h                | 6h (inchange)     |


## Fichier concerne

`supabase/functions/startlist-tracker/index.ts`

## Details techniques

### Changement dans `handleGlobalSync`

1. **Supprimer le filtre `last_tracker_check` de la requete Supabase** (ligne 399) : actuellement, la requete exclut les courses verifiees il y a moins de 6h directement au niveau SQL. On ne peut pas appliquer deux seuils differents dans une seule clause `.or()`.
2. **Appliquer le filtre en JavaScript** apres recuperation : pour chaque course, calculer si elle est "imminente" (date de debut dans les 7 prochains jours) et appliquer le seuil correspondant :
  - Course imminente : re-check si `last_tracker_check` est null ou plus ancien qu'**1 heure**
  - Autre course : re-check si `last_tracker_check` est null ou plus ancien que **6 heures**
3. **Trier par priorite** : les courses imminentes sont traitees en premier (elles sont plus urgentes), puis les autres par anciennete du dernier check.

### Code modifie (lignes ~128-131 et ~373-412)

- Ajouter une constante `RECHECK_INTERVAL_HOURS_URGENT = 1`
- Ajouter une fonction utilitaire `isUrgentCourse(course, now)` qui retourne `true` si la date de debut est dans les 7 prochains jours
- Modifier le filtre post-requete pour utiliser le bon seuil selon la proximite
- Ajuster le tri pour prioriser les courses urgentes

### Impact

- Aucun changement de schema en base
- Aucun changement du cron job (toujours toutes les 5 minutes)
- Le batch de 3 courses par run (`MAX_COURSES_PER_RUN = 3`) reste inchange
- Les courses imminentes seront simplement eligibles au re-check plus souvent, et priorisees dans la file