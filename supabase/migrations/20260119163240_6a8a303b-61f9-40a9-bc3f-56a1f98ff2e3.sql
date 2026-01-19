-- Create table for league-scoped startlist notes
CREATE TABLE public.league_startlist_notes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
    startlist_id UUID NOT NULL REFERENCES public.startlist_imports(id) ON DELETE CASCADE,
    admin_rating_note TEXT,
    admin_rating_author_id UUID REFERENCES public.managers(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(league_id, startlist_id)
);

-- Enable RLS
ALTER TABLE public.league_startlist_notes ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_league_startlist_notes_league_id ON public.league_startlist_notes(league_id);
CREATE INDEX idx_league_startlist_notes_startlist_id ON public.league_startlist_notes(startlist_id);

-- RLS policies
CREATE POLICY "Everyone can read league startlist notes"
ON public.league_startlist_notes FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert league startlist notes"
ON public.league_startlist_notes FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update league startlist notes"
ON public.league_startlist_notes FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Add trigger for updated_at
CREATE TRIGGER update_league_startlist_notes_updated_at
BEFORE UPDATE ON public.league_startlist_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.league_startlist_notes IS 'Stores league-specific startlist notes to avoid cross-league data leakage';