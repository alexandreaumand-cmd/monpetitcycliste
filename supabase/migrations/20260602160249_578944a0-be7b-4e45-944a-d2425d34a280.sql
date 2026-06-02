-- Purge bad AuRA import (created before UTF-16BE PDF fix) and force re-scrape
DELETE FROM startlist_entries WHERE startlist_id='a2661a65-1b59-4b30-9be8-69140de771d6';
DELETE FROM startlist_imports WHERE id='a2661a65-1b59-4b30-9be8-69140de771d6';
UPDATE courses SET last_tracker_check=NULL WHERE pcs_slug='tour-auvergne-rhone-alpes';