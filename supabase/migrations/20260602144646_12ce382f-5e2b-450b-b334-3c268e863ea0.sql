DELETE FROM public.startlist_entries WHERE startlist_id = 'f9bd123b-9d06-4cc1-958a-2b06ac248160';
DELETE FROM public.startlist_imports WHERE id = 'f9bd123b-9d06-4cc1-958a-2b06ac248160';
UPDATE public.courses SET last_tracker_check = NULL WHERE id = 'tour-auvergne-rhone-alpes-mj6w48yf';