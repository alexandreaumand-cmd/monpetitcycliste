
ALTER TABLE public.auctions
  ADD COLUMN announcements_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN announcements_paused_by uuid REFERENCES public.managers(id);
