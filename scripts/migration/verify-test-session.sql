-- LECTURE SEULE : traces du test local sur la copie (aucune donnée personnelle affichée).
\pset footer off
\echo '== Connexions sur la copie depuis 24 h'
SELECT count(*) AS utilisateurs_connectes, max(last_sign_in_at) AS derniere_connexion
FROM auth.users WHERE last_sign_in_at > now() - interval '24 hours';
\echo '== Sessions ouvertes sur la copie depuis 24 h'
SELECT count(*) AS sessions FROM auth.sessions WHERE created_at > now() - interval '24 hours';
\echo '== Appels HTTP sortants de la base (pg_net) depuis 24 h, par code'
SELECT status_code, count(*) FROM net._http_response WHERE created > now() - interval '24 hours' GROUP BY 1 ORDER BY 1;
