-- Répétition à blanc de l'anonymisation : tout est ANNULÉ à la fin (ROLLBACK).
BEGIN;
\i C:/LaBordure/scripts/migration/sql/preprod-anonymize.sql
ROLLBACK;
\echo '== Répétition terminée : ROLLBACK, aucune modification conservée.'
