ALTER TABLE public.communication_batches
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz NULL;

CREATE OR REPLACE FUNCTION public.enqueue_email_at(
  queue_name text,
  payload jsonb,
  send_at timestamptz
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  msg_id bigint;
  delay_seconds integer;
BEGIN
  delay_seconds := GREATEST(0, EXTRACT(EPOCH FROM (send_at - now()))::integer);
  SELECT pgmq.send(queue_name, payload, delay_seconds) INTO msg_id;
  RETURN msg_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_email_at(text, jsonb, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_email_at(text, jsonb, timestamptz) TO service_role;