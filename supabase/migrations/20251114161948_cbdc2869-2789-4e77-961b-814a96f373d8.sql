-- Créer une fonction trigger pour synchroniser la suppression des points_ledger
CREATE OR REPLACE FUNCTION sync_delete_points_ledger()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM points_ledger
  WHERE course_id = OLD.course_id
    AND coureur_id = OLD.coureur_id
    AND type_classement = OLD.type_classement
    AND (etape_numero = OLD.etape_numero OR (etape_numero IS NULL AND OLD.etape_numero IS NULL));
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger sur race_results
CREATE TRIGGER race_results_delete_sync
AFTER DELETE ON race_results
FOR EACH ROW
EXECUTE FUNCTION sync_delete_points_ledger();