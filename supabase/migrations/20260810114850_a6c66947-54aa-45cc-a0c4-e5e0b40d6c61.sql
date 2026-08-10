CREATE TABLE public.tweet_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id text NOT NULL,
  etape_numero integer,
  kind text NOT NULL CHECK (kind IN ('stage','gc','oneday')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','error')),
  tweet_id text,
  text text,
  error text,
  image_path text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX tweet_posts_unique_target
  ON public.tweet_posts (course_id, COALESCE(etape_numero, -1), kind);

GRANT SELECT ON public.tweet_posts TO authenticated;
GRANT ALL ON public.tweet_posts TO service_role;

ALTER TABLE public.tweet_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can view tweet posts"
  ON public.tweet_posts FOR SELECT TO authenticated
  USING (public.is_superadmin());

CREATE TRIGGER tweet_posts_touch
  BEFORE UPDATE ON public.tweet_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_feature_flags (flag_name, is_enabled, description)
VALUES ('auto_tweet_results', true, 'Publication automatique de tweets lors de l''enregistrement des résultats')
ON CONFLICT (flag_name) DO NOTHING;