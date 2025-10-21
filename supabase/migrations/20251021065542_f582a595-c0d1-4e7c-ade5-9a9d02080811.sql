-- Étape 1: Ajouter 'superadmin' à l'enum app_role
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'superadmin';