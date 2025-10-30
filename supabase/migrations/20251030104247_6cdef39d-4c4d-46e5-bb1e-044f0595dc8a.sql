-- ========================================
-- PHASE 1 : Nettoyage des enchères fantômes
-- ========================================

-- 1. SUPPRIMER les enchères fantômes (impossible de les réparer sans phase_id)
DELETE FROM auctions WHERE phase_id IS NULL;

-- 2. Ajouter contrainte NOT NULL sur phase_id
ALTER TABLE auctions
ALTER COLUMN phase_id SET NOT NULL;

-- ========================================
-- PHASE 4 : Cron job de sécurité
-- ========================================

-- Fonction de nettoyage des enchères fantômes uniquement
CREATE OR REPLACE FUNCTION auto_close_ghost_auctions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_closed_count INTEGER;
BEGIN
  -- Fermer UNIQUEMENT les enchères fantômes (phase_id NULL)
  -- Cette situation ne devrait plus arriver grâce à la contrainte NOT NULL,
  -- mais on garde cette fonction comme filet de sécurité
  UPDATE auctions
  SET 
    statut = 'closed',
    closed_at = NOW()
  WHERE statut = 'open'
    AND phase_id IS NULL;
  
  GET DIAGNOSTICS v_closed_count = ROW_COUNT;
  
  -- Log si des enchères ont été fermées (situation anormale)
  IF v_closed_count > 0 THEN
    RAISE WARNING 'Closed % ghost auctions (phase_id NULL) - This should not happen!', v_closed_count;
  END IF;
END;
$$;

-- Programmer l'exécution toutes les 5 minutes
SELECT cron.schedule(
  'auto-close-ghost-auctions',
  '*/5 * * * *',
  $$ SELECT auto_close_ghost_auctions(); $$
);