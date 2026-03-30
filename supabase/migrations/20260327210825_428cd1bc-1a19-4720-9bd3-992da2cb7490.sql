-- Move rosters from phase 1 to phase 2 for "TEST Saison entière 3 managers" league
UPDATE rosters 
SET phase_id = '8b939cb8-7079-4938-ba00-920603813092'
WHERE phase_id = '73e540d2-d008-4d13-ac93-72aec3d5d986'
  AND league_id = (SELECT id FROM leagues WHERE name ILIKE '%TEST Saison%3%' LIMIT 1);

-- Update auctions too
UPDATE auctions
SET phase_id = '8b939cb8-7079-4938-ba00-920603813092'
WHERE phase_id = '73e540d2-d008-4d13-ac93-72aec3d5d986'
  AND league_id = (SELECT id FROM leagues WHERE name ILIKE '%TEST Saison%3%' LIMIT 1);

-- refresh_standings_views() removed — views are regular, not materialized.