DO $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH updated AS (
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
      AND l.status = 'active'
    RETURNING a.id
  )
  SELECT count(*) INTO v_count FROM updated;
  RAISE NOTICE '[unblock-auctions] Opened % auction(s)', v_count;
END;
$$;