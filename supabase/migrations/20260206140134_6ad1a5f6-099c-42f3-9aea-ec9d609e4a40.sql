-- Drop both clone triggers that cause infinite recursion
-- The arena_broadcast_live_message RPC already handles broadcasting to all leagues
DROP TRIGGER IF EXISTS trg_clone_broadcast_message ON public.arena_messages;
DROP TRIGGER IF EXISTS trigger_clone_broadcast ON public.arena_messages;

-- Also drop the now-unused clone function
DROP FUNCTION IF EXISTS public.clone_broadcast_message();