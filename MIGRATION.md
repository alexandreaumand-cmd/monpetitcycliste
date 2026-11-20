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

### Étape 6 : edge functions ✅ (98 sur 100, toutes les fonctions utiles)
- **Limite du forfait gratuit confirmée : 100 fonctions par projet.** La 101ᵉ est refusée (`402 function.max_count`).
- **Regroupement** pour tenir sous la limite : 22 fonctions sont devenues 4 fonctions « aiguilleurs », qui sélectionnent l'action par sous-chemin (`supabase.functions.invoke("admin-users/create")`) :
  - `admin-users` : `create`, `delete`, `resend-confirmation`, `reset-password`, `set-role`, `list`, `toggle-ban` (ex-`admin-user-*`, `admin-users-list`)
  - `exports` : `all-tables`, `baremes-csv`, `coureurs-csv`, `courses-csv`, `resultats-csv`, `rosters-csv` (ex-`export-*`)
  - `auction-get` : `context`, `live-status`, `managers-status`, `teams`, `validation-status` (ex-`auction-get-*`)
  - `league-invites` : `create`, `list`, `revoke`, `info` (ex-`leagues-create-invite`, `leagues-list-invites`, `leagues-revoke-invite`, `leagues-get-invite-info`)
  - Code : `supabase/functions/<groupe>/handlers/<action>.ts` (fichier d'origine déplacé avec `git mv`). Seules l'en-tête et la ligne `serve(` → `registerHandler("<action>",` changent. Aiguillage : `supabase/functions/_shared/router.ts`. Front : 33 appels mis à jour dans 20 fichiers (`scripts/migration/group-functions*.ps1`).
  - Vérifié (`scripts/migration/verify-routers.ps1`) : action inconnue → 404 de l'aiguilleur ; chaque action répond avec les messages de son code d'origine ; CORS OK.
- **98 fonctions déployées = toutes les fonctions utiles.** Les 9 anciennes versions séparées (`auction-get-*`, invitations) ont été supprimées du nouveau projet. Restent non déployées, volontairement : les 7 inutiles et `process-email-queue` (Lovable).
- ⚠️ **Ne jamais lancer `supabase functions deploy` sans nom de fonction** : le repo contient 106 dossiers, au-delà de la limite. Utiliser `deploy-functions-batches.ps1 -Needed C:\LaBordure-data\functions_needed.txt` (liste des 98).
- ⚠️ **Le front de la branche ne fonctionne qu'avec le nouveau projet** (les aiguilleurs n'existent pas sur Lovable). Ne pas fusionner dans `main` avant la bascule.
- Build du front (`npm run build`) **pas encore lancé** (dépendances non installées).
- `verify_jwt = false` confirmé pour : `arena-recaps`, `live-broadcast-auto-scrape`, `scrape-rider-injuries`, `scrape-startlist-abandons`, `scrape-pcs-transfers`, `handle-email-unsubscribe`.

Historique de cette étape :
- Test initial : `course-leaderboard` (active, `verify_jwt = true`, CORS OK, 401 sans jeton).
- Déploiement groupé refusé : `402 Max number of functions reached for project` (`function.max_count`). Le forfait actuel n'accepte pas 124 fonctions.
- Tri (`C:\LaBordure-data\functions_usage.csv`) : **117 fonctions réellement appelées** (front, crons, SQL, appels entre fonctions). 7 inutiles : `auth-email-hook`, `handle-email-suppression`, `preview-transactional-email` (Lovable), `tweet`, `arena-recap-watchdog`, `arena-pronostic-standings`, `rider-points-detail`. `process-email-queue` est appelée mais dépend de Lovable.
- Déploiement par lots (`scripts/migration/deploy-functions-batches.ps1`, priorité crons > joueurs > admin) interrompu par le réseau (Wi-Fi instable : `TransportError`). Aucun lot n'a été appliqué.
- `supabase/config.toml` : `verify_jwt = false` ajouté pour les 5 fonctions appelées par cron sans jeton, qui vérifient elles-mêmes `x-cron-secret` (`arena-recaps`, `live-broadcast-auto-scrape`, `scrape-rider-injuries`, `scrape-startlist-abandons`, `scrape-pcs-transfers`).
- **Twitter/X abandonné** (décision du propriétaire : l'API est payante). Les secrets `TWITTER_*`, `X_*` et `RELAY_PASSWORD` ne seront pas saisis, et `tweet-race-result` échouera si elle est appelée. À retirer du front et des fonctions en phase 2, ce qui libérera aussi une place de fonction.
- VAPID (push) : non saisi en phase 1, pour éviter les envois en double. À la bascule, reprendre les clés d'origine si possible, sinon les joueurs devront réactiver les notifications.
- Secrets d'edge functions **à saisir par le propriétaire** (Edge Functions → Secrets) : `CRON_SECRET`, `LIVE_BROADCAST_CRON_SECRET`, `EMAIL_FROM_DOMAIN`, `EMAIL_ROOT_DOMAIN`, `EMAIL_SENDER_DOMAIN`, `EMAIL_SITE_NAME`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `TWITTER_CONSUMER_KEY`, `TWITTER_CONSUMER_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_TOKEN_SECRET`, `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`, `RELAY_PASSWORD`. Ne marchent qu'avec Lovable : `LOVABLE_API_KEY`, `LOVABLE_SEND_URL`.

### Étape 7 : crons ✅ (créés désactivés, 2026-11-19)
- `07-crons.sql` exécuté : 14 jobs, tous `active = false`, aucun ne visant l'ancien projet. Secrets Vault créés par le propriétaire. `CRON_SECRET` et `LIVE_BROADCAST_CRON_SECRET` sont de **nouvelles valeurs** (absentes ou illisibles sur Lovable), identiques entre Vault et les secrets des fonctions.
- Tests (`07b-test-crons.sql`) : `refresh_standings_cache()` OK (9,6 s) ; appel pg_net avec l'URL et la clé anon lues dans Vault → 404 de l'aiguilleur, donc la clé est acceptée par la passerelle.
- Pas encore testé : un cron avec `x-cron-secret` de bout en bout (ces fonctions font du scraping et écrivent dans la copie).
- Sur Lovable, la liste des secrets ne contient pas de `CRON_SECRET` : les fonctions qui l'attendent (`arena-recaps`, `scrape-rider-injuries`, `scrape-pcs-transfers`) ne le recevaient pas. Les journaux Lovable n'ont pas été consultés.

Détails du SQL :
- Fichier : `scripts/migration/sql/07-crons.sql`. Il recrée les 14 jobs du backup (6 purement SQL, 8 appels HTTP) avec les mêmes horaires, corps et conditions. Les URLs visent le nouveau projet et les secrets sont lus dans Vault (rien en dur). Le script s'arrête si un secret manque.
- Il réécrit aussi `public.trigger_auto_open_auctions()`, restaurée avec l'URL et la clé **de l'ancien projet** en dur (elle appellerait la prod Lovable).
- Changement volontaire : `scrape-pcs-transfers-daily` envoie en plus `x-cron-secret` (sur Lovable, il n'envoyait que `apikey`, que la fonction refuse ; le cron échouait donc probablement).
- Prérequis (Vault, saisi par le propriétaire) : `project_ref`, `project_anon_key`, `cron_secret`, `live_broadcast_cron_secret`. Les edge functions appelées doivent être déployées avant.
- **Les 14 jobs sont créés désactivés** (décision du propriétaire) : tant que Lovable tourne, la copie ne doit pas envoyer de rappels push, de récaps ni de tweets en double. On teste un job en exécutant sa commande à la main, et on active tout à la bascule : `SELECT cron.alter_job(jobid, active := true) FROM cron.job;`.
- Le job `process-email-queue` (migrations) n'existe pas dans le backup. La fonction `public.email_queue_wake()` (qui le créerait) et `email_queue_dispatch()` visent encore l'ancien projet ; elles sont inertes tant que les files `pgmq` ne sont pas recréées (phase 2, emails).

### Étape 8 : Realtime ✅ (option A, 2026-11-19)
- `08-realtime.sql` exécuté avec l'option A (décision du propriétaire) : `supabase_realtime` publie `annonces` et `notifications`, comme Lovable. Les autres tables restent non publiées, et l'option B reste disponible plus tard, table par table.

Détails :
- Fichier : `scripts/migration/sql/08-realtime.sql`. Par défaut, il reproduit l'état réel de Lovable (backup) : `annonces`, `notifications`.
- Le front s'abonne aussi à `arena_messages`, `arena_reactions`, `coureurs`, `courses`, `equipes`, `rosters`, `scoring_rules`, qui n'étaient pas publiées sur Lovable au 18/11. L'option B, en commentaire dans le fichier, les ajoute.

### Étape 9 : connexion Google / Apple (constat, aucune modification)
- **Oui, le code utilise `lovable.auth`** : `src/pages/Auth.tsx:267` (Google) et `:294` (Apple) appellent `lovable.auth.signInWithOAuth`, défini dans `src/integrations/lovable/index.ts` (`@lovable.dev/cloud-auth-js`, broker OAuth de Lovable, puis `supabase.auth.setSession`).
- `src/integrations/supabase/client.ts` utilise `brokeredPreviewStorage` (`previewAuthStorage.ts`), une logique de stockage de session liée aux domaines de preview Lovable.
- Hors Lovable, ces boutons ne fonctionneront pas. Concerne 80 comptes (73 Google, 7 Apple), sur 158.

### À faire (dans l'ordre)
1. Installer les dépendances et lancer `npm run build` pour valider le front modifié (appels des fonctions regroupées), puis tester les écrans admin, exports, enchères et invitations sur le nouveau projet.
2. Saisir les secrets d'edge functions (liste ci-dessus).
3. Créer les 4 secrets Vault, puis relire et exécuter `07-crons.sql`.
4. Choisir l'option Realtime, puis relire et exécuter `08-realtime.sql`.
5. Commit de la branche `migration/supabase-phase1` (sans `.backup` ni `.env`) ; ne pas pousser sur `main`.
6. Fin de phase 1 : supprimer `%APPDATA%\postgresql\pgpass.conf` ; garder `C:\LaBordure-data` hors OneDrive, puis le supprimer une fois la migration validée (données personnelles, hachages de mots de passe).
7. **Besoin exprimé (2026-11-20) : une prod ET une pré-prod.** À concevoir en phase 2 :
   - **Base :** deux projets Supabase. Le forfait gratuit permet 2 projets actifs par compte, le projet actuel `tokvwkkhwrgncurmipjh` étant le premier. L'autre option est le « branching » Supabase (forfait payant).
   - **Front :** deux adresses (par exemple `labordure.app` et `preprod.labordure.app`), chacune avec son `.env`.
   - **Fonctions et SQL :** chaque projet a sa limite de 100 fonctions, ses secrets, son Vault et ses crons. Les crons de la pré-prod doivent rester désactivés ou ne rien envoyer aux vrais joueurs.
   - **Données de la pré-prod :** copie de la prod (comme cette phase 1) ou jeu de test.
   - **Processus :** les migrations SQL et les fonctions passent d'abord par la pré-prod, puis par la prod. On ne rejoue plus le backup à la main.
8. Phase 2 et suivantes (hors périmètre) : Google/Apple sans `lovable.auth`, emails sans Lovable (`auth-email-hook`, `process-email-queue`, files `pgmq`), `.env` et `config.toml` vers le nouveau projet, réécriture des 444 URLs Storage en base, hébergement, puis un export frais juste avant la bascule (le backup date du 18/11 ; tout ce qui a été écrit depuis sur Lovable n'est pas dans la copie).

### Risques relevés
- **80 comptes Google/Apple** (73 + 7) passent par le broker Lovable (`lovable.auth`) : ils ne pourront pas se connecter hors Lovable tant que Google et Apple ne sont pas configurés sur le nouveau projet et que `src/pages/Auth.tsx` n'est pas adapté (phase 2).
- Sessions non transférées : tous les utilisateurs devront se reconnecter.
- **Données figées au 18/11 à 10:48** : la copie est une répétition. La bascule demandera un nouvel export (avec pause des écritures sur Lovable).
- Limite de 100 fonctions (forfait gratuit) : 98 utilisées. Toute nouvelle fonction devra rejoindre un aiguilleur existant, ou il faudra passer en Pro.
- Fonctions regroupées : si une de ces 22 fonctions est modifiée dans Lovable (`main`) d'ici la bascule, reporter la modification à la main dans `supabase/functions/<groupe>/handlers/<action>.ts`.
- Emails (inscription, réinitialisation de mot de passe, transactionnels) : dépendent de Lovable, pas encore remplacés.
- Le bucket `database_export_18_11_26` est celui des exports Lovable (il contient le backup lui-même) : ne pas y copier de fichiers.
- `pg_net` est installé dans le schéma `public` (comme sur Lovable), et non dans `extensions`.

## 3. Checklist de test (sur le nouveau projet, avant toute bascule)

**Préparation du test local (fait le 2026-11-19)**
- `.env.local` (ignoré par git) branche le front local sur `tokvwkkhwrgncurmipjh` (URL, clé anon publique, ref). Il remplace les valeurs de `.env` (Lovable) en local uniquement.
- `.claude/launch.json` : configuration `labordure-copie` (`npm run dev`, port 8080, Node portable).
- À lancer sur un réseau stable : `npm install`, puis `npm run build` (valide le front modifié), puis `npm run dev`.
- Périmètre du 1er test (propriétaire, compte email et mot de passe) : connexion et navigation, enchères en lecture seule. Le test à plusieurs joueurs se fera plus tard, sur une copie hébergée (phase 2).

**Résultat du test local du 2026-11-20 (propriétaire)** : front de la branche en local (`npm run dev`, `.env.local` sur la copie), connexion par email et mot de passe, puis navigation dans les écrans : **« fonctionne bien »** (retour du propriétaire). Côté copie : 1 connexion enregistrée (`auth.users.last_sign_in_at`, 2026-11-20 08:18 UTC), 2 sessions. Le build (`npm run build`) passe ; le bundle ne vise que `tokvwkkhwrgncurmipjh`. Non testé : enchères à plusieurs joueurs (à faire sur une copie hébergée), emails, Google/Apple, crons avec `x-cron-secret`.

**Connexion**
- [x] Un compte email existant se connecte avec son mot de passe actuel (hachage conservé), testé le 2026-11-20.
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
- [ ] `SELECT jobname, active FROM cron.job;` : 14 jobs, tous `active = false` en phase 1, aucun ne vise l'ancien projet.
- [ ] Test manuel d'un job sans effet visible pour les joueurs (par exemple `SELECT public.refresh_standings_cache();` ou la commande de `scrape-rider-injuries-daily`).
- [ ] À la bascule, après activation : `SELECT status, return_message FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;` sans échec.
- [ ] `SELECT status_code, count(*) FROM net._http_response GROUP BY 1;` : des 200, pas de 401 ni de 404.

**Realtime**
- [ ] `pg_publication_tables` contient les tables choisies.
- [ ] Une nouvelle annonce ou notification apparaît en direct dans un second navigateur, sans recharger la page.

## 4. Phase 2 : pré-prod (en cours)

**Organisation (décision du propriétaire, 2026-11-20)**
- **Prod** = `tokvwkkhwrgncurmipjh` (le projet de la phase 1, données du 18/11, Irlande). Les données Lovable ne doivent pas évoluer d'ici la bascule ; un export de contrôle (comparaison des comptes de lignes) sera fait juste avant.
- **Pré-prod** = `ltfmtbbthjvdjqosyanp` (« La Bordure preprod », Irlande, mot de passe distinct de la prod). Restaurée depuis le même backup, puis **anonymisée**.
- `psql-target.ps1` exige désormais `-Ref` (prod ou pré-prod) et affiche la cible ; `pgpass.conf` contient une ligne par projet.

**Pré-prod : fait**
- Restauration (même `restore.sql`) : 0 écart sur 80 tables (179 374 lignes), structure identique à la prod.
- Anonymisation (`scripts/migration/sql/preprod-anonymize.sql`, répétée à blanc puis appliquée) : 152 comptes anonymisés (`joueur-N@preprod.labordure.invalid`, mot de passe vidé, identités Google/Apple neutralisées), managers « Joueur NNN » / « Sponsor NNN », chat de l'Arena remplacé, emails et noms masqués dans les textes libres, push, messages de contact et journaux d'emails supprimés. **6 testeurs volontaires conservés** (liste locale `C:\LaBordure-data\preprod-testeurs.txt`, hors git) ; 5 ont un mot de passe, le 6ᵉ (Google/Apple) aura besoin d'un mot de passe de test.
- Garde-fous : le script refuse toute autre cible que la pré-prod, et s'arrête si un email de la liste ne correspond à aucun compte. Prod vérifiée intacte après l'opération.
- Limite : seuls les noms de 4 caractères et plus, tels qu'écrits dans `managers`, sont remplacés dans les textes libres.

**Pré-prod : à faire**
- Storage (maillots, images de parcours ; pas d'avatars).
- 98 fonctions, secrets (`CRON_SECRET`, `LIVE_BROADCAST_CRON_SECRET` propres à la pré-prod ; jamais VAPID ni emails réels).
- Vault + crons désactivés (`07-crons.sql` à paramétrer pour la ref pré-prod), Realtime option A.
- Réglage Auth : désactiver « Confirm email » pour permettre la création de comptes de test.
