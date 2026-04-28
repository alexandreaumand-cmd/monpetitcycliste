## Objectif

Modifier la fonction `auto_archive_completed_leagues()` pour qu'elle archive une ligue dès que **toutes ses courses/phases sont terminées**, **même si des enchères sont encore `open` ou `pending_validation`** ou si des annonces ne sont pas publiées.

C'est la fin du périmètre sportif qui déclenche l'archivage, pas l'état des enchères.

## Changements

### 1. Migration SQL — `auto_archive_completed_leagues()`

Retirer dans la fonction :
- le `NOT EXISTS (SELECT 1 FROM auctions WHERE league_id = l.id AND statut IN ('open','pending_validation'))`
- le `NOT EXISTS (SELECT 1 FROM annonces ... WHERE published = false)`

On garde :
- la condition mode `per_course` : tous les `selected_course_ids` ont `date_fin < CURRENT_DATE`
- la condition mode `five_phases` / `full_season` : toutes les phases du scope ont `status = 'completed'`
- l'exclusion de la ligue Legacy
- le passage à `status = 'completed'` + `archived_at = now()`

### 2. Rattrapage immédiat

La même migration relance `SELECT public.auto_archive_completed_leagues();` pour archiver d'un coup les ligues actuellement bloquées par l'ancien garde-fou (ex. *Roubaix 2026*, *Ligue Du Nord*, *COPArdennaises*, etc.).

### 3. Cron

Inchangé : le job nocturne quotidien à 03h30 reste planifié, il appellera désormais la version sans garde-fou.

## Notes

- Aucun changement frontend.
- Les enchères encore `open`/`scheduled` sur des ligues archivées resteront visibles via leurs hooks existants ; côté UI elles n'apparaissent plus dans les sections "actives" du Dashboard puisque la ligue passe en "Terminées". Si tu veux qu'on ferme aussi automatiquement ces enchères orphelines au moment de l'archivage, dis-le et j'ajoute un `UPDATE auctions SET statut='closed'` dans la même fonction — sinon je laisse les enchères telles quelles.
