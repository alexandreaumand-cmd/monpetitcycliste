\pset footer off
SELECT bucket_id, split_part(name,'/',1) AS premier_dossier, count(*) FROM storage.objects GROUP BY 1,2 ORDER BY 1,2;
