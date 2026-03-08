
-- Add unique constraint for upsert on prestige points
ALTER TABLE public.arena_prestige_points ADD CONSTRAINT arena_prestige_points_source_unique UNIQUE (source_type, source_id);

-- Trigger function: award prestige point when a reaction is added
CREATE OR REPLACE FUNCTION public.award_prestige_on_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author_manager_id uuid;
  v_league_id uuid;
BEGIN
  -- Get the message author and league
  SELECT m.author_manager_id, m.league_id
  INTO v_author_manager_id, v_league_id
  FROM arena_messages m
  WHERE m.id = NEW.message_id;

  -- Don't award points for reacting to your own message or system messages
  IF v_author_manager_id IS NULL OR v_author_manager_id = NEW.manager_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO arena_prestige_points (league_id, manager_id, points, source_type, source_id)
  VALUES (v_league_id, v_author_manager_id, 1, 'reaction_received', NEW.id)
  ON CONFLICT (source_type, source_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Trigger function: remove prestige point when a reaction is removed
CREATE OR REPLACE FUNCTION public.remove_prestige_on_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM arena_prestige_points
  WHERE source_type = 'reaction_received' AND source_id = OLD.id;
  RETURN OLD;
END;
$$;

-- Create triggers
CREATE TRIGGER trg_prestige_reaction_insert
  AFTER INSERT ON public.arena_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.award_prestige_on_reaction();

CREATE TRIGGER trg_prestige_reaction_delete
  BEFORE DELETE ON public.arena_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.remove_prestige_on_reaction();
