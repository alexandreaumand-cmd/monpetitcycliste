-- Autoriser les superadmins à modifier les coureurs
CREATE POLICY "Superadmins can update coureurs"
  ON coureurs FOR UPDATE
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- Autoriser les superadmins à modifier coureurs_saisons
CREATE POLICY "Superadmins can update coureurs_saisons"
  ON coureurs_saisons FOR UPDATE
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

CREATE POLICY "Superadmins can insert coureurs_saisons"
  ON coureurs_saisons FOR INSERT
  WITH CHECK (is_superadmin());