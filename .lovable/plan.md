
Objectif
- Faire réapparaître les exécutions automatiques (toutes les 5 minutes) dans l’onglet “Historique” du Startlist Tracker en Live.

Constat (ce qui se passe réellement)
- Le job planifié en Live s’exécute bien toutes les 5 minutes (cron OK).
- Mais l’appel HTTP du job “Live” déclenche une exécution qui écrit ses lignes (startlist_tracker_runs) dans l’environnement Test au lieu de Live.
- Résultat visible côté UI : en Live, l’historique s’arrête à ~09:30 pour les runs “global”, et tu ne vois ensuite que les runs manuels (déclenchés depuis l’UI Live, eux écrivent bien en Live).

Preuves (diagnostic déjà établi)
- En Live, cron.job_run_details montre des exécutions “succeeded” à 14:35, 14:40, 14:45, … 14:55.
- En Live, net._http_response contient une réponse 200 à 14:55 avec un run_id = 22c5… et races_analyzed=0.
- Ce run_id 22c5… n’existe pas dans startlist_tracker_runs en Live, mais existe dans startlist_tracker_runs en Test.
→ Donc le job Live pointe vers l’endpoint/les clés de Test (mauvaise configuration d’URL et/ou d’en-têtes), ce qui “déroute” l’écriture vers Test.

Cause la plus probable
- Le cron job en Live a été (re)créé avec l’URL et/ou la clé “publishable/anon” de l’environnement Test (typiquement lors d’un correctif précédent).
- Dans Lovable Cloud, Test et Live sont isolés : un job planifié doit impérativement appeler l’URL + les clés de l’environnement Live pour que les écritures aillent en Live.

Plan de correction (sans changer le code applicatif)
1) Récupérer les paramètres Live (dans Lovable Cloud)
   - Ouvrir le backend Lovable Cloud (environnement Live).
   - Repérer :
     - l’URL de base du backend Live (celle utilisée par l’app publiée)
     - la clé publishable Live (celle utilisée côté navigateur)
   - Important : ne pas réutiliser les valeurs de l’environnement Test.

2) Remplacer le cron job en Live (un seul job, propre)
   - Supprimer/désactiver les éventuels doublons (si tu en as eu dans le passé).
   - Recréer un unique job “startlist-tracker-sync” toutes les 5 minutes, avec :
     - url := “URL Live …/functions/v1/startlist-tracker”
     - headers := Content-Type + Authorization Bearer “clé publishable Live”
     - body := {"source_type":"global"}
     - timeout_milliseconds := 30000

   Exemple SQL (à exécuter dans le backend Lovable Cloud, environnement Live) :
   - Remplacer uniquement les 2 placeholders :
     - __LIVE_BACKEND_URL__
     - __LIVE_PUBLISHABLE_KEY__

   ```sql
   -- 1) Nettoyage (safe)
   select cron.unschedule('startlist-tracker-sync');

   -- 2) Recréation en 5 minutes, avec URL + clé LIVE
   select
     cron.schedule(
       'startlist-tracker-sync',
       '*/5 * * * *',
       $$
       select
         net.http_post(
           url := '__LIVE_BACKEND_URL__/functions/v1/startlist-tracker',
           headers := jsonb_build_object(
             'Content-Type', 'application/json',
             'Authorization', 'Bearer __LIVE_PUBLISHABLE_KEY__'
           ),
           body := jsonb_build_object('source_type', 'global'),
           timeout_milliseconds := 30000
         ) as request_id;
       $$
     );
   ```

3) Vérifications (pour être sûr à 100%)
   - Attendre 5 à 10 minutes.
   - Vérifier dans l’onglet “Historique” :
     - apparition de nouvelles lignes avec source_type = global
     - started_at récent (toutes les 5 minutes)
     - courses_processed peut être vide si rien à faire : c’est normal, mais la ligne doit quand même apparaître.
   - Vérification technique (optionnelle) :
     - prendre un run_id récent renvoyé par net._http_response (Live)
     - confirmer que ce run_id existe bien dans startlist_tracker_runs (Live). (C’est le test décisif qui prouve que l’écriture est revenue en Live.)

Option de durcissement (si tu veux éviter que ça se reproduise)
- Ajouter dans l’UI “Historique” un indicateur “Dernière exécution auto” basé sur cron.job_run_details + net._http_response, et afficher un warning si le dernier run_id ne se retrouve pas en base Live (symptôme typique d’un appel vers le mauvais environnement).
- Ce point implique une petite modification front (facultatif), mais il rend le problème immédiatement visible à l’avenir.

Ce que je ferai après approbation de ce plan (phase d’implémentation)
- Je te guiderai précisément dans Lovable Cloud (où récupérer les 2 valeurs Live) et je te donnerai la version finale du SQL “prêt à coller” avec le minimum de manip.
- Ensuite, on fera une vérification end-to-end : un run automatique doit apparaître dans l’historique Live dans les 5 minutes.
