-- Force PostgREST schema cache reload (in case of stale cache)
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- Unblock all scheduled auctions whose opens_at has passed and whose league is active
UPDATE public.auctions a
SET statut = 'open',
    deadline_at = CASE
      WHEN a.deadline_at > now() THEN a.deadline_at
      ELSE now() + interval '24 hours'
    END
FROM public.leagues l
WHERE a.league_id = l.id
  AND a.statut = 'scheduled'
  AND a.opens_at <= now()
  AND l.status = 'active';