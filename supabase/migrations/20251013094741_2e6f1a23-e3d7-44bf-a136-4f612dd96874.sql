-- Ajouter les coureurs bonus pour Matt B (P1 à P5)
INSERT INTO bonus_rider_selections (manager_id, phase_id, coureur_id)
VALUES
  ('fc1f58a4-ec7f-49c3-ab7a-62f9b2ada9ea', '56c927b5-108b-4366-ab15-3a9525c2247d', 'dylan_teuns'),      -- P1: Dylan TEUNS
  ('fc1f58a4-ec7f-49c3-ab7a-62f9b2ada9ea', '5fb099d4-73df-4b14-9367-5395fdb60ccb', 'tim_van_dijke'),    -- P2: Tim VAN DIJKE
  ('fc1f58a4-ec7f-49c3-ab7a-62f9b2ada9ea', '5b085a4a-bdd5-4dee-ab20-6eba93883479', 'louis_meintjes'),   -- P3: Louis MEINTJES
  ('fc1f58a4-ec7f-49c3-ab7a-62f9b2ada9ea', '737d8579-57fc-4b47-905e-63402c2952ee', 'cristian_rodriguez'), -- P4: Cristian RODRIGUEZ
  ('fc1f58a4-ec7f-49c3-ab7a-62f9b2ada9ea', '66edf120-0892-4c1c-ae83-0f9a1e0baf5f', 'lorenzo_quartucci'); -- P5: Lorenzo QUARTUCCI