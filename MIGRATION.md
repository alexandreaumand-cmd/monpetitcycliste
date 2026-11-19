# Migration Lovable Cloud → Supabase personnel — Phase 1

> Aucun secret dans ce fichier : uniquement des noms.
> Phase 1 = récupérer les données sur le nouveau Supabase. La prod reste sur Lovable.

## 1. Inventaire du repo (2026-11-19, branche `migration/supabase-phase1`)

### Projets Supabase référencés dans le code
| Ref | Où | Remarque |
|---|---|---|
| `oisfvryhpovwxaxqbmow` | `.env`, `supabase/config.toml`, 11 fichiers d'edge functions (templates email, `send-communication-email`, `resend-failed-communication`) | Projet Lovable Cloud actuel (à confirmer) |
| `khahpetvqjoyrwambaqn` | 4 migrations (URL `net.http_post` du cron `process-email-queue`, entre autres) | Ancien ref ? À comparer avec `cron.job` |

### Edge functions
124 fonctions dans `supabase/functions` + `_shared`. `verify_jwt` est réglé par fonction dans `supabase/config.toml`.
Dépendent de Lovable : `auth-email-hook`, `handle-email-suppression`, `process-email-queue` (`@lovable.dev/email-js`, `@lovable.dev/webhooks-js`, `LOVABLE_API_KEY`, `LOVABLE_SEND_URL`).

### Secrets lus par les edge functions (noms seulement)
- Fournis automatiquement par Supabase : `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- À saisir : `CRON_SECRET`, `LIVE_BROADCAST_CRON_SECRET`, `EMAIL_FROM_DOMAIN`, `EMAIL_ROOT_DOMAIN`, `EMAIL_SENDER_DOMAIN`, `EMAIL_SITE_NAME`, `RELAY_PASSWORD`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `TWITTER_CONSUMER_KEY`, `TWITTER_CONSUMER_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_TOKEN_SECRET`, `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`
- Propres à Lovable (ne fonctionneront pas hors Lovable) : `LOVABLE_API_KEY`, `LOVABLE_SEND_URL`
- Secret Vault (base de données) : `email_queue_service_role_key` (utilisé par le cron `process-email-queue`). Il ne fait pas partie du backup et devra être recréé.

### Variables front (Vite)
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (+ `VITE_SUPABASE_PROJECT_ID` dans `.env`).

### Buckets Storage
- Créés dans les migrations (publics) : `startlist-route-images`, `sponsor-jerseys`, `manager-avatars`, `email-assets`
- Utilisé dans le code mais absent des migrations : `tweets` (URL signée de 300 s, `src/pages/admin/SuperAdminTweetsPage.tsx`). Probablement privé.
- Liste définitive à prendre dans le backup (`storage.buckets`) et tes téléchargements.

### Realtime
- Publiées dans les migrations (`supabase_realtime`) : `annonces`, `arena_messages`, `arena_reactions`, `notifications`
- Écoutées dans `src/` sans publication dans les migrations : `coureurs`, `courses`, `equipes`, `rosters`, `scoring_rules`. Elles ont peut-être été activées dans l'UI : à vérifier dans le backup.

### Extensions
`pg_cron`, `pg_net`, `pgmq` (file d'emails `transactional_emails`), `supabase_vault`, `unaccent`.

### Crons
15 migrations appellent `cron.schedule` (dont `process-email-queue`, toutes les 5 s, via pgmq + Vault). Liste définitive : résultat de `cron.job`.

### Lovable auth / SDK
- `src/integrations/lovable/index.ts` : `createLovableAuth` (`@lovable.dev/cloud-auth-js`)
- `src/pages/Auth.tsx:267` : `lovable.auth.signInWithOAuth("google")`
- `src/pages/Auth.tsx:294` : `lovable.auth.signInWithOAuth("apple")`
- `src/integrations/supabase/previewAuthStorage.ts` : logique liée aux domaines Lovable (preview)

### Points d'attention
- `.env` est **suivi par git** (commité par Lovable). Il ne contient que l'URL et la clé publishable, mais ajouter `.env` au `.gitignore` n'arrête pas son suivi. Le désindexer (`git rm --cached .env`) sur `main` pourrait affecter le build Lovable : décision à prendre en phase 2.

## 2. Fait / à faire / risques

### Outils (poste Windows sans droits admin)
- git 2.56 (`C:\Program Files\Git`), Node v26.13.1 et PostgreSQL 17.12 portables dans `%USERPROFILE%\tools` (zips officiels, SHA-256 de Node vérifié). Supabase CLI 3.2.0 via `npx supabase`.
- Le réseau de l'entreprise bloque le protocole Postgres (TCP ouvert, handshake en timeout) : restauration faite depuis un autre réseau.
- Mot de passe de la base : saisi par le propriétaire dans `%APPDATA%\postgresql\pgpass.conf` (à supprimer en fin de phase 1). Un premier mot de passe a été exposé en clair dans un terminal et a été réinitialisé.

### Étape 3 : restauration (2026-11-19) ✅
- Backup : `monpetitcycliste_261118.backup`, export du 2026-11-18 à 10:48 (Postgres 17.6, zstd). Cible : `tokvwkkhwrgncurmipjh` (eu-west-1, Postgres 17.12), vide au départ.
- Méthode : `pg_restore -l`, puis liste filtrée (`scripts/migration/build-restore-list.ps1`), puis SQL (`build-restore-sql.ps1`), puis `psql --single-transaction` avec `session_replication_role = replica` (`psql-target.ps1`).
- Schémas gérés par Supabase (auth, storage, realtime, vault) non recréés ; seules les **données** `auth.users` et `auth.identities` sont chargées depuis le backup. Les migrations du repo n'ont pas été rejouées.
- 1er essai annulé (schéma `pgmq` manquant pour `CREATE EXTENSION pgmq`). Liste corrigée, 2e essai validé.
- 105 GRANT vers `sandbox_exec` (rôle interne Lovable) retirés. Avertissements sans effet : « no privileges were granted for unaccent* » (`anon` et `authenticated` ont bien EXECUTE).
- **Non restauré, volontairement** : `auth.sessions`, `refresh_tokens`, `audit_log_entries` (42 066 lignes), `flow_state`, `one_time_tokens`, `mfa_amr_claims` ; `storage.objects` (étape 5) ; `cron.*` (étape 7) ; `vault.secrets` (à recréer) ; publications Realtime (étape 8) ; files `pgmq` et leur contenu (206 emails en échec dans la DLQ).

### Étape 4 : vérification ✅
- Nombre de lignes : 80 tables comparées (75 public + auth.users, auth.identities, storage.buckets, drizzle, supabase_migrations) : **0 écart**, 179 374 lignes de chaque côté.
- Auth : 158 utilisateurs, 169 identités (89 email, 73 Google, 7 Apple), 0 identité orpheline, 91 utilisateurs avec mot de passe.
- Structure public : 75 tables, toutes avec RLS ; 224 policies (+17 sur storage.objects) ; 127 fonctions ; 26 vues ; 3 vues matérialisées ; 37 triggers ; 126 FK, toutes validées.
- Extensions : pg_cron 1.6.4, pg_net 0.20.4 (schéma public, comme sur Lovable), pgmq 1.5.1, unaccent, pgcrypto, uuid-ossp, pg_stat_statements, supabase_vault.
- Buckets (7) : `email-assets`, `manager-avatars`, `sponsor-jerseys`, `startlist-route-images` (publics) ; `admin-exports`, `tweets`, `database_export_18_11_26` (privés).

### Étape 5 : Storage ✅
- **417 fichiers** envoyés dans les 4 buckets publics avec `supabase storage cp -r <dossier> ss:/// --remote=<ref>` (`scripts/migration/supabase.ps1`). Comparaison avec le manifeste (`scripts/migration/compare-storage.ps1`) : 0 manquant, 0 en trop, 0 écart de taille ou de type. 10 URLs publiques testées : HTTP 200, tailles identiques.
- Incidents (corrigés) : un premier envoi vers `ss:///<bucket>` a créé un dossier en trop (`manager-avatars/manager-avatars/…`), et les 10 copies ont été supprimées ; une erreur 429 (`too_many_connections`) avec `-j 4` a laissé 40 fichiers manquants, renvoyés ensuite avec `-j 1`.
- Buckets privés `tweets`, `admin-exports` et `database_export_18_11_26` : **laissés vides à la demande du propriétaire** (plus utilisés). Les lignes `storage.buckets` existent toujours.
- `storage.objects.owner` est vide pour les fichiers envoyés (le backup avait le propriétaire d'origine). Sans impact : aucune policy n'utilise `owner`.

Détails de l'inventaire Storage :
- Le backup contient la **liste** de 457 fichiers (`storage.objects`), pas leur contenu. Le manifeste est dans `C:\LaBordure-data\storage\storage_manifest.csv`.
- Buckets publics : 417 fichiers (`startlist-route-images` 369, `sponsor-jerseys` 37, `manager-avatars` 10, `email-assets` 1), téléchargés en lecture seule depuis leurs URLs publiques (`scripts/migration/download-public-storage.ps1`), toutes les tailles conformes.
- Buckets privés `tweets` (39 fichiers) et `admin-exports` (1, 21,6 Mo) : non copiés (décision du propriétaire). `database_export_18_11_26` est vide dans le backup.
- Les policies `storage.objects` reposent sur `bucket_id` et le chemin (`storage.foldername(name)`), pas sur `owner` : garder les mêmes chemins suffit.
- **URLs signées (`token=`) stockées en base : aucune.**
- **URLs publiques de l'ancien projet** (`oisfvryhpovwxaxqbmow.supabase.co/storage/...`) stockées en base, dans 444 lignes : `course_route_images` (240), `courses` (119), `startlist_imports` (32), `manager_sponsors` (27), `communication_batches` (17), `managers` (8), `communication_templates` (1). Elles fonctionnent tant que Lovable Cloud existe. Il faudra les réécrire vers le nouveau projet au moment de la bascule.
- `arena_recap_runs` : 466 lignes mentionnent les anciens refs (journaux d'exécution), sans impact.

### Étape 6 : edge functions ⏳ (bloquée)
- 124 fonctions dans le repo. **Déployée : 1** (`course-leaderboard`, test : active, `verify_jwt = true`, CORS OK, 401 sans jeton).
- Déploiement groupé refusé : `402 Max number of functions reached for project` (`function.max_count`). Le forfait actuel n'accepte pas 124 fonctions.
- Tri (`C:\LaBordure-data\functions_usage.csv`) : **117 fonctions réellement appelées** (front, crons, SQL, appels entre fonctions). 7 inutiles : `auth-email-hook`, `handle-email-suppression`, `preview-transactional-email` (Lovable), `tweet`, `arena-recap-watchdog`, `arena-pronostic-standings`, `rider-points-detail`. `process-email-queue` est appelée mais dépend de Lovable.
- Déploiement par lots (`scripts/migration/deploy-functions-batches.ps1`, priorité crons > joueurs > admin) interrompu par le réseau (Wi-Fi instable : `TransportError`). Aucun lot n'a été appliqué.
- `supabase/config.toml` : `verify_jwt = false` ajouté pour les 5 fonctions appelées par cron sans jeton, qui vérifient elles-mêmes `x-cron-secret` (`arena-recaps`, `live-broadcast-auto-scrape`, `scrape-rider-injuries`, `scrape-startlist-abandons`, `scrape-pcs-transfers`).
- Secrets d'edge functions **à saisir par le propriétaire** (Edge Functions → Secrets) : `CRON_SECRET`, `LIVE_BROADCAST_CRON_SECRET`, `EMAIL_FROM_DOMAIN`, `EMAIL_ROOT_DOMAIN`, `EMAIL_SENDER_DOMAIN`, `EMAIL_SITE_NAME`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `TWITTER_CONSUMER_KEY`, `TWITTER_CONSUMER_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_TOKEN_SECRET`, `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`, `RELAY_PASSWORD`. Ne marchent qu'avec Lovable : `LOVABLE_API_KEY`, `LOVABLE_SEND_URL`.

### Étape 7 : crons 📝 (SQL prêt, non exécuté)
- Fichier : `scripts/migration/sql/07-crons.sql`. Il recrée les 14 jobs du backup (6 purement SQL, 8 appels HTTP) avec les mêmes horaires, corps et conditions. Les URLs visent le nouveau projet et les secrets sont lus dans Vault (rien en dur). Le script s'arrête si un secret manque.
- Il réécrit aussi `public.trigger_auto_open_auctions()`, restaurée avec l'URL et la clé **de l'ancien projet** en dur (elle appellerait la prod Lovable).
- Changement volontaire : `scrape-pcs-transfers-daily` envoie en plus `x-cron-secret` (sur Lovable, il n'envoyait que `apikey`, que la fonction refuse ; le cron échouait donc probablement).
- Prérequis (Vault, saisi par le propriétaire) : `project_ref`, `project_anon_key`, `cron_secret`, `live_broadcast_cron_secret`. Les edge functions appelées doivent être déployées avant.
- Le job `process-email-queue` (migrations) n'existe pas dans le backup. La fonction `public.email_queue_wake()` (qui le créerait) et `email_queue_dispatch()` visent encore l'ancien projet ; elles sont inertes tant que les files `pgmq` ne sont pas recréées (phase 2, emails).

### Étape 8 : Realtime 📝 (SQL prêt, non exécuté)
- Fichier : `scripts/migration/sql/08-realtime.sql`. Par défaut, il reproduit l'état réel de Lovable (backup) : `annonces`, `notifications`.
- Le front s'abonne aussi à `arena_messages`, `arena_reactions`, `coureurs`, `courses`, `equipes`, `rosters`, `scoring_rules`, qui n'étaient pas publiées sur Lovable au 18/11. L'option B, en commentaire dans le fichier, les ajoute.

### Étape 9 : connexion Google / Apple (constat, aucune modification)
- **Oui, le code utilise `lovable.auth`** : `src/pages/Auth.tsx:267` (Google) et `:294` (Apple) appellent `lovable.auth.signInWithOAuth`, défini dans `src/integrations/lovable/index.ts` (`@lovable.dev/cloud-auth-js`, broker OAuth de Lovable, puis `supabase.auth.setSession`).
- `src/integrations/supabase/client.ts` utilise `brokeredPreviewStorage` (`previewAuthStorage.ts`), une logique de stockage de session liée aux domaines de preview Lovable.
- Hors Lovable, ces boutons ne fonctionneront pas. Concerne 80 comptes (73 Google, 7 Apple), sur 158.

### À faire (dans l'ordre)
1. Réseau stable, puis décision sur la limite de fonctions (forfait Pro, ou regroupement de fonctions), puis déploiement des 116 à 117 fonctions utiles (`deploy-functions-batches.ps1`).
2. Saisir les secrets d'edge functions (liste ci-dessus).
3. Créer les 4 secrets Vault, puis relire et exécuter `07-crons.sql`.
4. Choisir l'option Realtime, puis relire et exécuter `08-realtime.sql`.
5. Commit de la branche `migration/supabase-phase1` (sans `.backup` ni `.env`) ; ne pas pousser sur `main`.
6. Fin de phase 1 : supprimer `%APPDATA%\postgresql\pgpass.conf` ; garder `C:\LaBordure-data` hors OneDrive, puis le supprimer une fois la migration validée (données personnelles, hachages de mots de passe).
7. Phase 2 et suivantes (hors périmètre) : Google/Apple sans `lovable.auth`, emails sans Lovable (`auth-email-hook`, `process-email-queue`, files `pgmq`), `.env` et `config.toml` vers le nouveau projet, réécriture des 444 URLs Storage en base, hébergement, puis un export frais juste avant la bascule (le backup date du 18/11 ; tout ce qui a été écrit depuis sur Lovable n'est pas dans la copie).

### Risques relevés
- **80 comptes Google/Apple** (73 + 7) passent par le broker Lovable (`lovable.auth`) : ils ne pourront pas se connecter hors Lovable tant que Google et Apple ne sont pas configurés sur le nouveau projet et que `src/pages/Auth.tsx` n'est pas adapté (phase 2).
- Sessions non transférées : tous les utilisateurs devront se reconnecter.
- **Données figées au 18/11 à 10:48** : la copie est une répétition. La bascule demandera un nouvel export (avec pause des écritures sur Lovable).
- Limite de fonctions du forfait : sans Pro, toutes les fonctions utiles ne tiendront pas sur le projet.
- Emails (inscription, réinitialisation de mot de passe, transactionnels) : dépendent de Lovable, pas encore remplacés.
- Le bucket `database_export_18_11_26` est celui des exports Lovable (il contient le backup lui-même) : ne pas y copier de fichiers.
- `pg_net` est installé dans le schéma `public` (comme sur Lovable), et non dans `extensions`.

## 3. Checklist de test (sur le nouveau projet, avant toute bascule)

**Connexion**
- [ ] Un compte email existant se connecte avec son mot de passe actuel (hachage conservé).
- [ ] Réinitialisation de mot de passe : l'email arrive ? (dépend du fournisseur d'email, probablement KO avant la phase 2).
- [ ] Les boutons Google et Apple : échec attendu tant que `lovable.auth` est en place (à noter, pas à corriger en phase 1).
- [ ] Création d'un compte de test, puis présence dans `auth.users` et dans `public.managers` (triggers).

**Données**
- [ ] Les comptes de lignes du backup et de Supabase correspondent (fait : 0 écart sur 80 tables).
- [ ] Un utilisateur voit ses ligues, son équipe, ses enchères ; il ne voit pas celles des autres (RLS).
- [ ] Les classements et les résultats d'une course connue sont identiques à Lovable.

**Fichiers**
- [ ] Les avatars, maillots et images de parcours s'affichent depuis `tokvwkkhwrgncurmipjh.supabase.co/storage/...`.
- [ ] Un upload d'avatar par un utilisateur fonctionne (policy `storage.foldername`).

**Fonctions**
- [ ] `supabase functions list` : toutes les fonctions utiles sont `ACTIVE`, et les 5 fonctions cron sont en `verify_jwt = false`.
- [ ] Un écran qui appelle une fonction (classement, enchères) répond sans erreur 401 ou 500.
- [ ] Les logs des fonctions (dashboard) ne signalent aucun secret manquant.

**Crons**
- [ ] `SELECT jobname, active FROM cron.job;` : 14 jobs, aucun ne vise l'ancien projet.
- [ ] Après un passage (15 min) : `SELECT status, return_message FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;` sans échec.
- [ ] `SELECT status_code, count(*) FROM net._http_response GROUP BY 1;` : des 200, pas de 401 ni de 404.

**Realtime**
- [ ] `pg_publication_tables` contient les tables choisies.
- [ ] Une nouvelle annonce ou notification apparaît en direct dans un second navigateur, sans recharger la page.
