-- Drop and recreate the view to include races with stage results (not just final GC)
DROP VIEW IF EXISTS v_home_recent_results;

CREATE VIEW v_home_recent_results AS
WITH recent_courses AS (
    -- Get courses that have ANY race_results, ordered by date_fin desc
    SELECT DISTINCT 
        c.id AS course_id,
        c.nom AS course_nom,
        c.date_fin
    FROM courses c
    JOIN race_results rr ON rr.course_id = c.id
    WHERE c.date_fin <= CURRENT_DATE + INTERVAL '7 days' -- Include races happening now (up to 7 days in future)
    ORDER BY c.date_fin DESC
    LIMIT 6
),
-- For each course, get the best available results:
-- Priority: General (final GC) > Etape (latest stage)
best_results AS (
    SELECT 
        rc.course_id,
        rc.course_nom,
        rc.date_fin,
        co.nom AS coureur_nom,
        co.equipe AS coureur_equipe,
        rr.points,
        rr.position,
        rr.type_classement,
        rr.etape_numero,
        ROW_NUMBER() OVER (
            PARTITION BY rc.course_id 
            ORDER BY 
                -- Priority: General first, then latest stage
                CASE WHEN rr.type_classement = 'General' AND rr.etape_numero IS NULL THEN 0 ELSE 1 END,
                COALESCE(rr.etape_numero, 0) DESC,
                rr.position
        ) AS rn
    FROM recent_courses rc
    JOIN race_results rr ON rr.course_id = rc.course_id
    JOIN coureurs co ON co.id = rr.coureur_id
    WHERE 
        -- Include General (final) OR Etape results
        (rr.type_classement = 'General' AND rr.etape_numero IS NULL)
        OR rr.type_classement = 'Etape'
)
SELECT 
    course_id,
    course_nom,
    date_fin,
    COALESCE(SUM(points), 0) AS total_points,
    jsonb_agg(
        jsonb_build_object(
            'position', position,
            'coureur_nom', coureur_nom,
            'coureur_equipe', coureur_equipe,
            'points', points
        ) ORDER BY position
    ) FILTER (WHERE rn <= 3) AS top3
FROM best_results
WHERE rn <= 10 -- Keep top 10 for the course
GROUP BY course_id, course_nom, date_fin
ORDER BY date_fin DESC;