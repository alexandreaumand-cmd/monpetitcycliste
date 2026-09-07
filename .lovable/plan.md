# Supprimer la table de debug exposée

## Constat vérifié
- La table `_debug_standings_audit` (colonnes : manager_id, league_id, saison_id, total_race_pts) est **vide** (0 ligne) et la protection d'accès (RLS) est **désactivée**.
- Elle n'est utilisée nulle part dans l'application : aucune requête dans le code, seule une mention automatique dans le fichier de types généré.
- Une ancienne migration avait déjà tenté d'activer la protection, mais l'état actuel de la base montre qu'elle n'est pas active.

## Correction proposée
Supprimer purement et simplement cette table de débogage : elle ne sert à rien, ne contient aucune donnée, et sa suppression élimine définitivement la faille au lieu de la contourner.

Étapes :
1. Migration : `DROP TABLE IF EXISTS public._debug_standings_audit;`
2. Régénération automatique du fichier de types après la migration.
3. Marquer l'alerte de sécurité `debug_audit_no_rls` comme corrigée, après vérification que la table n'apparaît plus.

## Alternative si vous voulez la garder
Activer la protection d'accès, retirer les droits pour les rôles publics (`anon`, `authenticated`) et n'autoriser que les super-admins en lecture/écriture. Dites-le moi et j'ajuste le plan.

Aucun impact sur les classements, les points ou l'interface : rien dans l'app ne lit cette table.
