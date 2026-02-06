
-- Enable realtime for arena_messages and arena_reactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'arena_messages'
    AND schemaname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.arena_messages;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'arena_reactions'
    AND schemaname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.arena_reactions;
  END IF;
END $$;

-- Create broadcast clone trigger function
CREATE OR REPLACE FUNCTION public.clone_broadcast_message()
RETURNS TRIGGER AS $$
BEGIN
  -- Clone admin_broadcast message to all other active leagues' live-courses channels
  INSERT INTO public.arena_messages (channel_id, league_id, author_manager_id, message_type, content, metadata, source_message_id)
  SELECT 
    c.id,
    c.league_id,
    NEW.author_manager_id,
    'admin_broadcast',
    NEW.content,
    NEW.metadata,
    NEW.id
  FROM public.arena_channels c
  JOIN public.leagues l ON l.id = c.league_id
  WHERE c.slug = 'live-courses'
    AND c.league_id != NEW.league_id
    AND l.status = 'active';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger (only on original broadcasts, not clones)
DROP TRIGGER IF EXISTS trigger_clone_broadcast ON public.arena_messages;
CREATE TRIGGER trigger_clone_broadcast
AFTER INSERT ON public.arena_messages
FOR EACH ROW
WHEN (NEW.message_type = 'admin_broadcast' AND NEW.source_message_id IS NULL)
EXECUTE FUNCTION public.clone_broadcast_message();

-- Auto-create arena channels for new leagues
CREATE OR REPLACE FUNCTION public.create_arena_channels_for_league()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.arena_channels (league_id, slug)
  VALUES (NEW.id, 'general'), (NEW.id, 'live-courses')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_create_arena_channels ON public.leagues;
CREATE TRIGGER trigger_create_arena_channels
AFTER INSERT ON public.leagues
FOR EACH ROW
EXECUTE FUNCTION public.create_arena_channels_for_league();
