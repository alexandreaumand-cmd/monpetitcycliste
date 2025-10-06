-- Partie 1: Ajouter les nouveaux types de classement pour les porteurs de maillots
ALTER TYPE type_classement ADD VALUE IF NOT EXISTS 'Porteur Général';
ALTER TYPE type_classement ADD VALUE IF NOT EXISTS 'Porteur Vert';
ALTER TYPE type_classement ADD VALUE IF NOT EXISTS 'Porteur Montagne';
ALTER TYPE type_classement ADD VALUE IF NOT EXISTS 'Porteur Jeune';
ALTER TYPE type_classement ADD VALUE IF NOT EXISTS 'Porteur Combattif';