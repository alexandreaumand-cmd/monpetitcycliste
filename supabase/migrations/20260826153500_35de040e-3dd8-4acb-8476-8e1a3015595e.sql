ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type = ANY (ARRAY[
  'startlist_validated'::text,
  'results_added'::text,
  'auction_opened'::text,
  'auction_closed'::text,
  'auction_ready_to_close'::text,
  'auction_validation'::text,
  'rider_incident'::text,
  'rider_win'::text,
  'pronostic_reminder'::text
]));