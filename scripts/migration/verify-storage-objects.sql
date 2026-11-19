-- LECTURE SEULE : objets Storage présents dans la cible.
\pset footer off
SELECT bucket_id, count(*) AS fichiers, sum((metadata->>'size')::bigint) AS octets
FROM storage.objects GROUP BY bucket_id ORDER BY 1;
SELECT bucket_id, name, metadata->>'size' AS size, metadata->>'mimetype' AS mimetype
FROM storage.objects WHERE bucket_id = 'email-assets';
