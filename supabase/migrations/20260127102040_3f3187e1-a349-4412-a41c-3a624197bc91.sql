-- Ajouter la colonne preferences à la table push_subscriptions
ALTER TABLE public.push_subscriptions 
ADD COLUMN IF NOT EXISTS preferences jsonb 
DEFAULT '{"results": true, "startlists": true, "auctions": true}'::jsonb;

-- Ajouter une policy pour les updates (manquante actuellement)
CREATE POLICY "Users can update their own push subscriptions"
  ON public.push_subscriptions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());