-- LECTURE SEULE : structure restaurée (à comparer au backup).
\pset footer off
\echo '== Objets public'
SELECT
 (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p')) AS tables,
 (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relrowsecurity) AS tables_rls_actif,
 (SELECT count(*) FROM pg_policies WHERE schemaname='public') AS policies_public,
 (SELECT count(*) FROM pg_policies WHERE schemaname='storage') AS policies_storage,
 (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.deptype='e')) AS fonctions,
 (SELECT count(*) FROM pg_views WHERE schemaname='public') AS vues,
 (SELECT count(*) FROM pg_matviews WHERE schemaname='public') AS vues_materialisees,
 (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND NOT t.tgisinternal) AS triggers,
 (SELECT count(*) FROM pg_constraint co JOIN pg_namespace n ON n.oid=co.connamespace WHERE n.nspname='public' AND co.contype='f') AS fk,
 (SELECT count(*) FROM pg_indexes WHERE schemaname='public') AS index;

\echo '== Tables public SANS RLS (doit etre vide)'
SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p') AND NOT c.relrowsecurity;

\echo '== Contraintes FK non validees (doit etre vide)'
SELECT conrelid::regclass, conname FROM pg_constraint WHERE contype='f' AND NOT convalidated AND connamespace='public'::regnamespace;

\echo '== Extensions'
SELECT e.extname, e.extversion, n.nspname AS schema FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace ORDER BY 1;

\echo '== Droits anon/authenticated sur les tables public'
SELECT grantee, count(DISTINCT table_name) AS tables FROM information_schema.role_table_grants
WHERE table_schema='public' AND grantee IN ('anon','authenticated','service_role') GROUP BY grantee ORDER BY 1;

\echo '== unaccent utilisable par anon/authenticated'
SELECT has_function_privilege('anon', 'public.unaccent(text)', 'EXECUTE') AS anon,
       has_function_privilege('authenticated', 'public.unaccent(text)', 'EXECUTE') AS authenticated;

\echo '== Auth'
SELECT (SELECT count(*) FROM auth.users) AS users,
       (SELECT count(*) FROM auth.identities) AS identities,
       (SELECT count(*) FROM auth.identities i LEFT JOIN auth.users u ON u.id=i.user_id WHERE u.id IS NULL) AS identities_orphelines,
       (SELECT count(*) FROM auth.users WHERE encrypted_password IS NOT NULL AND encrypted_password <> '') AS avec_mot_de_passe;
SELECT provider, count(*) FROM auth.identities GROUP BY provider ORDER BY 1;

\echo '== Buckets'
SELECT id, public FROM storage.buckets ORDER BY id;

\echo '== Realtime (publication supabase_realtime)'
SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' ORDER BY 1,2;

\echo '== Crons existants (doit etre vide avant etape 7)'
SELECT count(*) AS jobs FROM cron.job;
