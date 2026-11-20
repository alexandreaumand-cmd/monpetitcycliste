-- LECTURE SEULE : état d'anonymisation (comptes uniquement, aucune donnée affichée).
\pset footer off
SELECT count(*) AS comptes,
       count(*) FILTER (WHERE email LIKE '%@preprod.labordure.invalid') AS emails_anonymises,
       count(*) FILTER (WHERE coalesce(encrypted_password,'') <> '') AS avec_mot_de_passe,
       (SELECT count(*) FROM public.managers WHERE nom LIKE 'Joueur %') AS managers_pseudonymes,
       (SELECT count(*) FROM public.push_subscriptions) AS push
FROM auth.users;
