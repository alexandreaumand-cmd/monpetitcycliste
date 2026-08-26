with e as (
  select id, channel_id, course_id, created_at, content,
    metadata->>'live_event_type' as t,
    coalesce(metadata->'rider_mentions'->0->>'rider_nom', substring(content from '\{([^}]+)\}')) as rider,
    substring(content from 'à\s+([0-9]+(?:[.,][0-9]+)?)\s*km') as km
  from public.arena_messages
  where message_type = 'admin_broadcast'
    and metadata->>'live_event_uid' is not null
), d as (
  select id, row_number() over (
    partition by channel_id, course_id, t, lower(rider), km
    order by length(content) desc, created_at desc
  ) as rn
  from e
)
delete from public.arena_messages m
using d
where m.id = d.id and d.rn > 1;