UPDATE courses 
SET last_tracker_check = NULL 
WHERE date_debut >= CURRENT_DATE - INTERVAL '7 days' 
AND date_debut <= CURRENT_DATE + INTERVAL '14 days'
AND pcs_slug IS NOT NULL;