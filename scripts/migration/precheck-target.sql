-- Pré-contrôle LECTURE SEULE du projet Supabase cible (aucune écriture).
\pset footer off
\echo '== Connexion'
SELECT current_user, current_database(), split_part(version(), ' ', 2) AS pg_version;

\echo '== Schemas non systeme et nombre de tables'
SELECT n.nspname AS schema, count(c.oid) FILTER (WHERE c.relkind IN ('r','p')) AS tables
FROM pg_namespace n LEFT JOIN pg_class c ON c.relnamespace = n.oid
WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
GROUP BY n.nspname ORDER BY n.nspname;

\echo '== Extensions installees'
SELECT extname, extversion FROM pg_extension ORDER BY extname;

\echo '== Contenu existant (doit etre vide)'
SELECT (SELECT count(*) FROM auth.users) AS auth_users,
       (SELECT count(*) FROM auth.identities) AS auth_identities,
       (SELECT count(*) FROM storage.buckets) AS buckets,
       (SELECT count(*) FROM storage.objects) AS objects;

\echo '== Roles utiles'
SELECT r AS role, EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) AS existe
FROM unnest(ARRAY['anon','authenticated','service_role','sandbox_exec']) AS r;

\echo '== Colonnes auth.users / auth.identities (compatibilite)'
SELECT table_name, count(*) AS colonnes
FROM information_schema.columns
WHERE table_schema = 'auth' AND table_name IN ('users','identities')
GROUP BY table_name;

\echo '== Test session_replication_role (session uniquement, annule aussitot)'
BEGIN;
SET LOCAL session_replication_role = replica;
SHOW session_replication_role;
ROLLBACK;
