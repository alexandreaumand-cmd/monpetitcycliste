-- == Sentinel table ===========================================================
CREATE TABLE IF NOT EXISTS public.app_migrations (
  name text PRIMARY KEY,
  executed_at timestamptz NOT NULL DEFAULT now()
);

-- Mark this migration as applied (idempotent)
INSERT INTO public.app_migrations(name)
VALUES ('2025-10-20-leagues-phase1')
ON CONFLICT (name) DO NOTHING;