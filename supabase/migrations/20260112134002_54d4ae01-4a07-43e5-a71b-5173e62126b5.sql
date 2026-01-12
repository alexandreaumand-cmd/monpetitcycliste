-- Politique INSERT : Un utilisateur authentifié peut créer son propre profil manager
CREATE POLICY "Users can insert their own manager profile" 
ON public.managers 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Politique UPDATE : Un utilisateur peut modifier son propre profil manager
CREATE POLICY "Users can update their own manager profile" 
ON public.managers 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);