
CREATE OR REPLACE FUNCTION auto_update_phase_statuts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE phases SET statut = 'completed' 
  WHERE date_fin < CURRENT_DATE AND statut != 'completed';
  
  UPDATE phases SET statut = 'active' 
  WHERE date_debut <= CURRENT_DATE AND date_fin >= CURRENT_DATE AND statut != 'active';
END;
$$;
