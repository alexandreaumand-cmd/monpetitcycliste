ALTER TABLE auctions ADD COLUMN effective_phase_id uuid REFERENCES phases(id);
UPDATE auctions SET effective_phase_id = phase_id WHERE effective_phase_id IS NULL;