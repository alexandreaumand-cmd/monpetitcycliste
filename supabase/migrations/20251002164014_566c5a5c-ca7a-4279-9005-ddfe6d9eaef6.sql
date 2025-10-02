-- Ajouter la colonne created_at à la table bids pour permettre le tri chronologique
ALTER TABLE bids ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();