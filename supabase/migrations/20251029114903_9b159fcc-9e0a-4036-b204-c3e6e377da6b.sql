-- Create optimized function to get unique teams for a phase
CREATE OR REPLACE FUNCTION public.get_unique_teams_for_phase(p_phase_id uuid)
RETURNS TABLE (team_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT DISTINCT cd.coureur_equipe::text
  FROM coureurs_disponibilite cd
  WHERE cd.phase_id = p_phase_id
    AND cd.coureur_equipe IS NOT NULL
  ORDER BY cd.coureur_equipe;
END;
$function$;