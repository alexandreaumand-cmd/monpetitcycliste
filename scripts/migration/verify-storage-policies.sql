-- LECTURE SEULE : policies storage.objects et usage du propriétaire (owner / owner_id).
\pset footer off
SELECT policyname, cmd,
       coalesce(qual,'') ~ 'owner' OR coalesce(with_check,'') ~ 'owner' AS utilise_owner,
       left(coalesce(qual, with_check), 160) AS condition
FROM pg_policies WHERE schemaname='storage' AND tablename='objects' ORDER BY policyname;
