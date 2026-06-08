## Diagnostic

La ligue **CopaGIRO** (mode « à la course », Giro d'Italia terminé le 31/05/2026) aurait dû être archivée automatiquement, mais elle est restée en statut `active`.

J'ai vérifié :
- La fonction SQL `public.auto_archive_completed_leagues()` existe et fonctionne — je l'ai appelée manuellement et elle a archivé **3 ligues** dont CopaGIRO, GIRO 2026 et Test. Donc la logique est correcte.
- Le cron Postgres associé (`auto-archive-completed-leagues`, planifié pour `30 3 * * *` chaque jour) n'a manifestement pas tourné, sinon ces ligues seraient déjà archivées depuis le 1ᵉʳ juin.
- Je n'ai pas l'accès direct au schéma `cron` pour confirmer l'état du job, mais l'absence d'archivage prouve qu'il n'a pas été exécuté avec succès depuis plusieurs jours.

CopaGIRO est désormais bien archivée (statut `completed`, `archived_at = 2026-06-08 12:55`) suite à l'exécution manuelle de la fonction lors du diagnostic.

## Plan correctif

### 1. Redéployer le cron d'archivage
Recréer le job `cron.schedule` pour `auto_archive_completed_leagues` afin de garantir qu'il est bien actif. La planification reste quotidienne à 03:30 UTC.

```sql
-- Désinscrire l'ancien job s'il existe (sans erreur si absent)
-- Reschedule auto-archive-completed-leagues à 03:30 UTC quotidien
```

### 2. Ajouter une exécution de contrôle
Appeler la fonction une fois après le reschedule pour balayer toute ligue terminée actuelle (déjà fait pour CopaGIRO/GIRO 2026/Test, mais ré-exécution idempotente).

### 3. Vérification post-déploiement
- Lister le job dans `cron.job` via le client admin Supabase pour confirmer `active = true`.
- Surveiller `cron.job_run_details` après la prochaine exécution à 03:30 UTC pour s'assurer du succès.

## Détails techniques

- **Fichier concerné** : nouvelle migration SQL `supabase/migrations/<timestamp>_reschedule_auto_archive_leagues.sql`.
- **Aucun changement** à la fonction `auto_archive_completed_leagues` elle-même — sa logique est correcte.
- **Aucun changement frontend** — dès que `status` passe à `completed` et `archived_at` est rempli, `useUserLeagues` filtre déjà la ligue de l'affichage du dashboard.

## Hors scope
- Refonte de la logique d'archivage par phases / mode complet.
- Ajout d'une UI d'administration pour relancer manuellement le job (peut être ajouté ultérieurement si tu le souhaites).
