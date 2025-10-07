-- Associate user barraud.jp@gmail.com with manager JP
UPDATE public.managers 
SET user_id = '0091ef89-7667-4a98-9ce1-601609d6c9e3'
WHERE id = '274ba2e4-56f5-4527-8856-3889bae60d2b';

-- Add admin role for JP
INSERT INTO public.user_roles (user_id, role)
VALUES ('0091ef89-7667-4a98-9ce1-601609d6c9e3', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;