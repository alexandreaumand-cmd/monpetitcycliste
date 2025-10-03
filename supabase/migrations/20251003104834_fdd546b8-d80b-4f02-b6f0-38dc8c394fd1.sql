-- Create race_result_sets table to track unique result sets
CREATE TABLE IF NOT EXISTS public.race_result_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id text NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  type_classement type_classement NOT NULL,
  etape_numero integer NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT uniq_result_set UNIQUE (course_id, type_classement, etape_numero)
);

-- Enable RLS on race_result_sets
ALTER TABLE public.race_result_sets ENABLE ROW LEVEL SECURITY;

-- RLS policies for race_result_sets
CREATE POLICY "Everyone can view result sets"
ON public.race_result_sets
FOR SELECT
USING (true);

CREATE POLICY "Admins can insert result sets"
ON public.race_result_sets
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update result sets"
ON public.race_result_sets
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete result sets"
ON public.race_result_sets
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Add result_set_id to race_results
ALTER TABLE public.race_results
ADD COLUMN IF NOT EXISTS result_set_id uuid NULL REFERENCES race_result_sets(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_race_results_set ON race_results(result_set_id);
CREATE INDEX IF NOT EXISTS idx_race_results_scope ON race_results(course_id, type_classement, etape_numero);

-- Add unique constraint to prevent duplicate coureur in same result set
ALTER TABLE public.race_results
DROP CONSTRAINT IF EXISTS uniq_race_result_scope;

ALTER TABLE public.race_results
ADD CONSTRAINT uniq_race_result_scope
UNIQUE (course_id, type_classement, etape_numero, coureur_id);

-- Function to check result status for a course
CREATE OR REPLACE FUNCTION public.admin_result_status(p_course_id text)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_exists_by_type json;
  v_existing_stages int[];
BEGIN
  -- Check admin access
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé: réservé aux administrateurs';
  END IF;

  -- Get existing types
  SELECT json_object_agg(type_classement::text, true)
  INTO v_exists_by_type
  FROM (
    SELECT DISTINCT type_classement
    FROM race_result_sets
    WHERE course_id = p_course_id
  ) t;

  -- Get existing stage numbers
  SELECT ARRAY_AGG(DISTINCT etape_numero ORDER BY etape_numero)
  INTO v_existing_stages
  FROM race_result_sets
  WHERE course_id = p_course_id
    AND type_classement = 'Etape'
    AND etape_numero IS NOT NULL;

  RETURN json_build_object(
    'exists_by_type', COALESCE(v_exists_by_type, '{}'::json),
    'existing_stages', COALESCE(v_existing_stages, ARRAY[]::int[])
  );
END;
$$;

-- Function to check if a result set is unique
CREATE OR REPLACE FUNCTION public.admin_result_check_unique(
  p_course_id text,
  p_type_classement type_classement,
  p_etape_numero int DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- Check admin access
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé: réservé aux administrateurs';
  END IF;

  -- Check if result set exists
  SELECT EXISTS (
    SELECT 1
    FROM race_result_sets
    WHERE course_id = p_course_id
      AND type_classement = p_type_classement
      AND (
        (p_type_classement = 'Etape' AND etape_numero = p_etape_numero)
        OR (p_type_classement != 'Etape' AND etape_numero IS NULL)
      )
  ) INTO v_exists;

  RETURN json_build_object('exists', v_exists);
END;
$$;

-- Function to create a new result lot
CREATE OR REPLACE FUNCTION public.admin_result_create_lot(
  p_course_id text,
  p_type_classement type_classement,
  p_etape_numero int,
  p_rows jsonb
)
RETURNS json
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_manager_id uuid;
  v_result_set_id uuid;
  v_row jsonb;
  v_phase_id uuid;
  v_date_classement date;
  v_inserted_count int := 0;
BEGIN
  -- Check admin access
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé: réservé aux administrateurs';
  END IF;

  -- Get manager ID
  SELECT id INTO v_manager_id FROM managers WHERE user_id = auth.uid() LIMIT 1;

  -- Get course phase and date
  SELECT phase_id, COALESCE(date_fin, date_debut) 
  INTO v_phase_id, v_date_classement
  FROM courses WHERE id = p_course_id;

  -- Check uniqueness
  IF EXISTS (
    SELECT 1 FROM race_result_sets
    WHERE course_id = p_course_id
      AND type_classement = p_type_classement
      AND (
        (p_type_classement = 'Etape' AND etape_numero = p_etape_numero)
        OR (p_type_classement != 'Etape' AND etape_numero IS NULL)
      )
  ) THEN
    RAISE EXCEPTION 'Un résultat existe déjà pour ce type/étape';
  END IF;

  -- Create result set header
  INSERT INTO race_result_sets (course_id, type_classement, etape_numero, created_by)
  VALUES (p_course_id, p_type_classement, p_etape_numero, v_manager_id)
  RETURNING id INTO v_result_set_id;

  -- Insert all rows
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    INSERT INTO race_results (
      result_set_id,
      course_id,
      type_classement,
      etape_numero,
      coureur_id,
      position,
      statut,
      date_classement,
      updated_by_manager_id
    )
    VALUES (
      v_result_set_id,
      p_course_id,
      p_type_classement,
      p_etape_numero,
      (v_row->>'coureur_id')::text,
      (v_row->>'position')::int,
      (v_row->>'statut')::result_statut,
      v_date_classement,
      v_manager_id
    );
    v_inserted_count := v_inserted_count + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'result_set_id', v_result_set_id,
    'inserted_count', v_inserted_count
  );
END;
$$;

-- Function to update an existing result lot
CREATE OR REPLACE FUNCTION public.admin_result_update_lot(
  p_course_id text,
  p_type_classement type_classement,
  p_etape_numero int,
  p_rows jsonb
)
RETURNS json
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_manager_id uuid;
  v_result_set_id uuid;
  v_row jsonb;
  v_date_classement date;
  v_deleted_count int;
  v_inserted_count int := 0;
BEGIN
  -- Check admin access
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé: réservé aux administrateurs';
  END IF;

  -- Get manager ID
  SELECT id INTO v_manager_id FROM managers WHERE user_id = auth.uid() LIMIT 1;

  -- Get result set ID
  SELECT id INTO v_result_set_id
  FROM race_result_sets
  WHERE course_id = p_course_id
    AND type_classement = p_type_classement
    AND (
      (p_type_classement = 'Etape' AND etape_numero = p_etape_numero)
      OR (p_type_classement != 'Etape' AND etape_numero IS NULL)
    );

  IF v_result_set_id IS NULL THEN
    RAISE EXCEPTION 'Le résultat n''existe pas pour ce type/étape';
  END IF;

  -- Get course date
  SELECT COALESCE(date_fin, date_debut) 
  INTO v_date_classement
  FROM courses WHERE id = p_course_id;

  -- Delete existing results for this set
  DELETE FROM race_results
  WHERE result_set_id = v_result_set_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Insert updated rows
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    INSERT INTO race_results (
      result_set_id,
      course_id,
      type_classement,
      etape_numero,
      coureur_id,
      position,
      statut,
      date_classement,
      updated_by_manager_id
    )
    VALUES (
      v_result_set_id,
      p_course_id,
      p_type_classement,
      p_etape_numero,
      (v_row->>'coureur_id')::text,
      (v_row->>'position')::int,
      (v_row->>'statut')::result_statut,
      v_date_classement,
      v_manager_id
    );
    v_inserted_count := v_inserted_count + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'deleted_count', v_deleted_count,
    'inserted_count', v_inserted_count
  );
END;
$$;