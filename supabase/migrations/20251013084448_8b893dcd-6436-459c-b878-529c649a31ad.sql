-- Créer la table pour stocker le coureur bonus sélectionné par manager et phase
CREATE TABLE IF NOT EXISTS bonus_rider_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
  phase_id UUID NOT NULL REFERENCES phases(id) ON DELETE CASCADE,
  coureur_id TEXT NOT NULL REFERENCES coureurs(id) ON DELETE CASCADE,
  selected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Contrainte unique : un seul coureur bonus par manager et phase
  UNIQUE(manager_id, phase_id)
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_bonus_rider_manager_phase ON bonus_rider_selections(manager_id, phase_id);
CREATE INDEX IF NOT EXISTS idx_bonus_rider_coureur ON bonus_rider_selections(coureur_id);

-- Activer RLS
ALTER TABLE bonus_rider_selections ENABLE ROW LEVEL SECURITY;

-- Policy : les managers peuvent voir leur propre sélection
CREATE POLICY "Users can view their bonus rider selection"
  ON bonus_rider_selections FOR SELECT
  USING (manager_id IN (SELECT id FROM managers WHERE user_id = auth.uid()));

-- Policy : les managers peuvent créer leur propre sélection
CREATE POLICY "Users can create their bonus rider selection"
  ON bonus_rider_selections FOR INSERT
  WITH CHECK (manager_id IN (SELECT id FROM managers WHERE user_id = auth.uid()));

-- Policy : les admins peuvent tout voir
CREATE POLICY "Admins can view all bonus selections"
  ON bonus_rider_selections FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Fonction trigger pour calculer automatiquement les points bonus
CREATE OR REPLACE FUNCTION trigger_calculate_bonus_rider()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_bonus_rider BOOLEAN;
  v_bonus_amount INTEGER;
BEGIN
  -- Ne calculer que si le manager_id est défini et points > 0
  IF NEW.manager_id IS NULL OR NEW.points <= 0 THEN
    RETURN NEW;
  END IF;

  -- Vérifier si ce coureur est le bonus rider du manager pour cette phase
  SELECT EXISTS(
    SELECT 1 FROM bonus_rider_selections
    WHERE manager_id = NEW.manager_id
      AND phase_id = NEW.phase_id
      AND coureur_id = NEW.coureur_id
  ) INTO v_is_bonus_rider;

  -- Si c'est le bonus rider, calculer et insérer le bonus (25%)
  IF v_is_bonus_rider THEN
    v_bonus_amount := FLOOR(NEW.points * 0.25);
    
    -- Insérer le bonus dans bonus_points
    INSERT INTO bonus_points (
      phase_id,
      coureur_id,
      manager_id,
      target_manager_id,
      bonus_type,
      points,
      commentaire,
      created_by
    ) VALUES (
      NEW.phase_id,
      NEW.coureur_id,
      NEW.manager_id,
      NEW.manager_id,
      'coureur_bonuse',
      v_bonus_amount,
      'Bonus coureur automatique (25%) - ' || COALESCE(NEW.course_id, 'Course') || ' - ' || NEW.type_classement::text,
      NEW.manager_id
    );
    
    RAISE NOTICE 'Bonus coureur calculé: % pts pour coureur % (course: %)', v_bonus_amount, NEW.coureur_id, NEW.course_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Créer le trigger sur points_ledger
DROP TRIGGER IF EXISTS after_points_insert_calculate_bonus ON points_ledger;
CREATE TRIGGER after_points_insert_calculate_bonus
AFTER INSERT ON points_ledger
FOR EACH ROW
EXECUTE FUNCTION trigger_calculate_bonus_rider();