-- =====================================================================
-- Anonymisation de la PRÉ-PROD (ltfmtbbthjvdjqosyanp) après restauration du backup.
-- NE JAMAIS LANCER SUR LA PROD : garde-fou ci-dessous (la connexion est construite à partir de -Ref).
-- Lancement : psql-target.ps1 -Ref ltfmtbbthjvdjqosyanp -File preprod-anonymize.sql -SingleTransaction
--
-- Aucun INSERT dans auth.* : uniquement des UPDATE de colonnes personnelles.
-- Les triggers sont désactivés pendant le script (session_replication_role = replica) pour qu'aucune
-- mise à jour ne déclenche de notification, d'email ou d'appel HTTP.
-- =====================================================================

-- 0. Garde-fou : uniquement sur la pré-prod.
SELECT (:'target_ref' = 'ltfmtbbthjvdjqosyanp') AS est_preprod \gset
\if :est_preprod
  \echo '== Cible confirmée : PRE-PROD'
\else
  \echo 'ARRET : ce script ne tourne que sur la pré-prod (ltfmtbbthjvdjqosyanp).'
  \quit
\endif

SET LOCAL session_replication_role = replica;

-- Testeurs volontaires : comptes NON anonymisés (ils gardent email, mot de passe, nom, équipe).
-- Liste locale, hors git : C:\LaBordure-data\preprod-testeurs.txt (un email par ligne, lignes "#" ignorées).
CREATE TEMP TABLE anon_keep_raw (line text) ON COMMIT DROP;
\copy anon_keep_raw (line) FROM 'C:/LaBordure-data/preprod-testeurs.txt'
CREATE TEMP TABLE anon_keep ON COMMIT DROP AS
SELECT DISTINCT lower(btrim(replace(line, chr(65279), ''))) AS email
FROM anon_keep_raw
WHERE btrim(replace(line, chr(65279), '')) <> '' AND btrim(replace(line, chr(65279), '')) NOT LIKE '#%';
CREATE TEMP TABLE anon_keep_user ON COMMIT DROP AS
SELECT u.id AS user_id FROM auth.users u JOIN anon_keep k ON k.email = lower(u.email);
\echo '== Testeurs conservés (emails de la liste / comptes trouvés)'
SELECT (SELECT count(*) FROM anon_keep) AS emails_dans_la_liste,
       (SELECT count(*) FROM anon_keep_user) AS comptes_trouves;
-- Arrêt si un email de la liste ne correspond à aucun compte (faute de frappe : le testeur serait anonymisé).
SELECT ((SELECT count(*) FROM anon_keep) = (SELECT count(*) FROM anon_keep_user)) AS liste_ok \gset
\if :liste_ok
\else
  \echo 'ARRET : au moins un email de preprod-testeurs.txt ne correspond à aucun compte. Rien n a été modifié.'
  SELECT 1/0 AS arret_volontaire;
\endif

-- Numérotation stable : comptes par date de création, managers par date de création (testeurs exclus).
CREATE TEMP TABLE anon_user ON COMMIT DROP AS
SELECT id AS user_id,
       row_number() OVER (ORDER BY created_at, id) AS n,
       'joueur-' || row_number() OVER (ORDER BY created_at, id) || '@preprod.labordure.invalid' AS new_email
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM anon_keep_user);

CREATE TEMP TABLE anon_mgr ON COMMIT DROP AS
SELECT m.id AS manager_id, m.user_id, m.nom AS old_nom,
       row_number() OVER (ORDER BY m.created_at, m.id) AS n
FROM public.managers m
WHERE m.user_id IS NULL OR m.user_id NOT IN (SELECT user_id FROM anon_keep_user);

-- 1. auth.users : email, mot de passe (supprimé), téléphone, jetons, métadonnées.
UPDATE auth.users u SET
  email = a.new_email,
  encrypted_password = '',
  phone = NULL, phone_change = '', phone_change_token = '',
  email_change = '', email_change_token_new = '', email_change_token_current = '',
  confirmation_token = '', recovery_token = '', reauthentication_token = '',
  raw_user_meta_data = jsonb_build_object('email', a.new_email, 'email_verified', true)
FROM anon_user a WHERE a.user_id = u.id;

-- 2. auth.identities : identifiants et données du fournisseur (email, Google, Apple).
UPDATE auth.identities i SET
  provider_id = CASE WHEN i.provider = 'email' THEN i.user_id::text ELSE 'preprod-' || i.id::text END,
  identity_data = jsonb_build_object(
    'sub', CASE WHEN i.provider = 'email' THEN i.user_id::text ELSE 'preprod-' || i.id::text END,
    'email', a.new_email, 'email_verified', true)
FROM anon_user a WHERE a.user_id = i.user_id;

-- 3. managers : nom, email, sponsor, avatar.
UPDATE public.managers m SET
  nom = 'Joueur ' || lpad(am.n::text, 3, '0'),
  email = CASE WHEN m.email IS NULL THEN NULL
               ELSE coalesce((SELECT new_email FROM anon_user au WHERE au.user_id = m.user_id),
                             'manager-' || am.n || '@preprod.labordure.invalid') END,
  sponsor = CASE WHEN m.sponsor IS NULL THEN NULL ELSE 'Sponsor ' || lpad(am.n::text, 3, '0') END,
  avatar_url = NULL
FROM anon_mgr am WHERE am.manager_id = m.id;

UPDATE public.manager_sponsors s SET sponsor = 'Sponsor ' || lpad(am.n::text, 3, '0')
FROM anon_mgr am WHERE am.manager_id = s.manager_id;

-- 4. Données sans utilité en pré-prod : supprimées.
DELETE FROM public.push_subscriptions;        -- appareils des vrais joueurs : jamais de push depuis la pré-prod
DELETE FROM public.contact_messages;
DELETE FROM public.email_send_log;
DELETE FROM public.email_unsubscribe_tokens;
DELETE FROM public.suppressed_emails;

-- 5. Chat de l'Arena : contenu privé remplacé (sauf les messages écrits par les testeurs).
UPDATE public.arena_messages SET content = '[message anonymisé]'
WHERE content IS NOT NULL AND content <> ''
  AND (author_manager_id IS NULL OR author_manager_id IN (SELECT manager_id FROM anon_mgr));

-- 6. Textes libres : emails masqués, anciens noms de managers (4 caractères et plus) remplacés.
CREATE TEMP TABLE anon_names ON COMMIT DROP AS
SELECT old_nom, 'Joueur ' || lpad(n::text, 3, '0') AS new_nom FROM anon_mgr
WHERE length(old_nom) >= 4 ORDER BY length(old_nom) DESC;

DO $$
DECLARE r record;
  email_re constant text := '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}';
BEGIN
  UPDATE public.notifications          SET message      = regexp_replace(message,      email_re, 'email-masque@preprod.labordure.invalid', 'g') WHERE message      ~ email_re;
  UPDATE public.audits                 SET payload_json = regexp_replace(payload_json, email_re, 'email-masque@preprod.labordure.invalid', 'g') WHERE payload_json ~ email_re;
  UPDATE public.communication_batches  SET body_html    = regexp_replace(body_html,    email_re, 'email-masque@preprod.labordure.invalid', 'g') WHERE body_html    ~ email_re;
  FOR r IN SELECT old_nom, new_nom FROM anon_names LOOP
    UPDATE public.notifications         SET message      = replace(message,      r.old_nom, r.new_nom) WHERE strpos(message,      r.old_nom) > 0;
    UPDATE public.audits                SET payload_json = replace(payload_json, r.old_nom, r.new_nom) WHERE strpos(payload_json, r.old_nom) > 0;
    UPDATE public.communication_batches SET body_html    = replace(body_html,    r.old_nom, r.new_nom) WHERE strpos(body_html,    r.old_nom) > 0;
  END LOOP;
END $$;

-- 7. Contrôles (tous les compteurs "restants" doivent valoir 0).
\echo '== Contrôles'
SELECT
  (SELECT count(*) FROM auth.users WHERE email NOT LIKE '%@preprod.labordure.invalid'
     AND id NOT IN (SELECT user_id FROM anon_keep_user))                                         AS comptes_email_reel_restants,
  (SELECT count(*) FROM auth.users WHERE coalesce(encrypted_password, '') <> ''
     AND id NOT IN (SELECT user_id FROM anon_keep_user))                                         AS comptes_avec_mot_de_passe,
  (SELECT count(*) FROM auth.identities WHERE identity_data->>'email' NOT LIKE '%@preprod.labordure.invalid'
     AND user_id NOT IN (SELECT user_id FROM anon_keep_user))                                    AS identites_email_reel,
  (SELECT count(*) FROM public.managers m JOIN anon_mgr am ON am.manager_id = m.id WHERE m.nom = am.old_nom) AS managers_nom_inchange,
  (SELECT count(*) FROM public.managers WHERE email IS NOT NULL AND email NOT LIKE '%@preprod.labordure.invalid'
     AND id IN (SELECT manager_id FROM anon_mgr))                                                AS managers_email_reel,
  (SELECT count(*) FROM public.push_subscriptions)                                               AS push_restants,
  (SELECT count(*) FROM public.notifications WHERE message ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
                                               AND message !~ 'preprod\.labordure\.invalid')     AS notifications_email_reel;
SELECT count(*) AS comptes,
       count(*) FILTER (WHERE email LIKE 'joueur-%') AS comptes_anonymises,
       count(*) FILTER (WHERE id IN (SELECT user_id FROM anon_keep_user)) AS testeurs_conserves
FROM auth.users;
