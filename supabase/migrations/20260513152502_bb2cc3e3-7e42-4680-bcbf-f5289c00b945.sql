ALTER TABLE public.email_preferences
  ADD COLUMN IF NOT EXISTS auction_opened boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auction_closed boolean NOT NULL DEFAULT true;