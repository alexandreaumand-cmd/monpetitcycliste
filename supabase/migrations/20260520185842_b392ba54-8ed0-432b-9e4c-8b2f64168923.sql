UPDATE race_results rr
SET date_classement = csc.stage_date
FROM course_stage_config csc
WHERE rr.course_id = csc.course_id
  AND rr.etape_numero = csc.etape_numero
  AND csc.stage_date IS NOT NULL
  AND rr.date_classement IS DISTINCT FROM csc.stage_date;