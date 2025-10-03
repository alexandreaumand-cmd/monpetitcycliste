-- Ajouter les policies manquantes pour points_ledger
-- Les admins doivent pouvoir insérer/modifier les points

CREATE POLICY "Admins can insert points" 
ON points_ledger 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update points" 
ON points_ledger 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete points" 
ON points_ledger 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));