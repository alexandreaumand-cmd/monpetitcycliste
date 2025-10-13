-- Ajouter les coureurs bonus pour 6 managers (P1 à P5)
INSERT INTO bonus_rider_selections (manager_id, phase_id, coureur_id)
VALUES
  -- Matt L (c6a95b05-67b3-4244-8470-fabd09e14f62)
  ('c6a95b05-67b3-4244-8470-fabd09e14f62', '56c927b5-108b-4366-ab15-3a9525c2247d', 'victor_lafay'),
  ('c6a95b05-67b3-4244-8470-fabd09e14f62', '5fb099d4-73df-4b14-9367-5395fdb60ccb', 'rainer_kepplinger'),
  ('c6a95b05-67b3-4244-8470-fabd09e14f62', '5b085a4a-bdd5-4dee-ab20-6eba93883479', 'mike_teunissen'),
  ('c6a95b05-67b3-4244-8470-fabd09e14f62', '737d8579-57fc-4b47-905e-63402c2952ee', 'bastien_tronchon'),
  ('c6a95b05-67b3-4244-8470-fabd09e14f62', '66edf120-0892-4c1c-ae83-0f9a1e0baf5f', 'marco_frigo'),
  
  -- Manou (d86b7204-f19f-4fa3-8321-cc20ef17af3e)
  ('d86b7204-f19f-4fa3-8321-cc20ef17af3e', '56c927b5-108b-4366-ab15-3a9525c2247d', 'ruben_guerreiro'),
  ('d86b7204-f19f-4fa3-8321-cc20ef17af3e', '5fb099d4-73df-4b14-9367-5395fdb60ccb', 'tao_geoghegan_hart'),
  ('d86b7204-f19f-4fa3-8321-cc20ef17af3e', '5b085a4a-bdd5-4dee-ab20-6eba93883479', 'rainer_kepplinger'),
  ('d86b7204-f19f-4fa3-8321-cc20ef17af3e', '737d8579-57fc-4b47-905e-63402c2952ee', 'lennard_kamna'),
  ('d86b7204-f19f-4fa3-8321-cc20ef17af3e', '66edf120-0892-4c1c-ae83-0f9a1e0baf5f', 'andrea_bagioli'),
  
  -- JP (274ba2e4-56f5-4527-8856-3889bae60d2b)
  ('274ba2e4-56f5-4527-8856-3889bae60d2b', '56c927b5-108b-4366-ab15-3a9525c2247d', 'arne_marit'),
  ('274ba2e4-56f5-4527-8856-3889bae60d2b', '5fb099d4-73df-4b14-9367-5395fdb60ccb', 'dylan_teuns'),
  ('274ba2e4-56f5-4527-8856-3889bae60d2b', '5b085a4a-bdd5-4dee-ab20-6eba93883479', 'davide_piganzoli'),
  ('274ba2e4-56f5-4527-8856-3889bae60d2b', '737d8579-57fc-4b47-905e-63402c2952ee', 'louis_barre'),
  ('274ba2e4-56f5-4527-8856-3889bae60d2b', '66edf120-0892-4c1c-ae83-0f9a1e0baf5f', 'alexander_salby'),
  
  -- Bubu (b4d4c603-6f5c-4ea4-82fb-b90f62532788)
  ('b4d4c603-6f5c-4ea4-82fb-b90f62532788', '56c927b5-108b-4366-ab15-3a9525c2247d', 'cian_uijtdebroeks'),
  ('b4d4c603-6f5c-4ea4-82fb-b90f62532788', '5fb099d4-73df-4b14-9367-5395fdb60ccb', 'alexander_salby'),
  ('b4d4c603-6f5c-4ea4-82fb-b90f62532788', '5b085a4a-bdd5-4dee-ab20-6eba93883479', 'rick_pluimers'),
  ('b4d4c603-6f5c-4ea4-82fb-b90f62532788', '737d8579-57fc-4b47-905e-63402c2952ee', 'harold_martin_lopez'),
  ('b4d4c603-6f5c-4ea4-82fb-b90f62532788', '66edf120-0892-4c1c-ae83-0f9a1e0baf5f', 'dusan_rajovic'),
  
  -- Obi (a8dfc1cb-5584-4b85-8360-af8f88b20dbb)
  ('a8dfc1cb-5584-4b85-8360-af8f88b20dbb', '56c927b5-108b-4366-ab15-3a9525c2247d', 'arnaud_demare'),
  ('a8dfc1cb-5584-4b85-8360-af8f88b20dbb', '5fb099d4-73df-4b14-9367-5395fdb60ccb', 'arnaud_demare'),
  ('a8dfc1cb-5584-4b85-8360-af8f88b20dbb', '5b085a4a-bdd5-4dee-ab20-6eba93883479', 'arnaud_demare'),
  ('a8dfc1cb-5584-4b85-8360-af8f88b20dbb', '737d8579-57fc-4b47-905e-63402c2952ee', 'cian_uijtdebroeks'),
  ('a8dfc1cb-5584-4b85-8360-af8f88b20dbb', '66edf120-0892-4c1c-ae83-0f9a1e0baf5f', 'arnaud_demare'),
  
  -- Max (fe8f6b2f-7cb6-46d8-b34b-60776d3b96d4)
  ('fe8f6b2f-7cb6-46d8-b34b-60776d3b96d4', '56c927b5-108b-4366-ab15-3a9525c2247d', 'hugh_carthy'),
  ('fe8f6b2f-7cb6-46d8-b34b-60776d3b96d4', '5fb099d4-73df-4b14-9367-5395fdb60ccb', 'harm_vanhoucke'),
  ('fe8f6b2f-7cb6-46d8-b34b-60776d3b96d4', '5b085a4a-bdd5-4dee-ab20-6eba93883479', 'christian_scaroni'),
  ('fe8f6b2f-7cb6-46d8-b34b-60776d3b96d4', '737d8579-57fc-4b47-905e-63402c2952ee', 'jake_stewart'),
  ('fe8f6b2f-7cb6-46d8-b34b-60776d3b96d4', '66edf120-0892-4c1c-ae83-0f9a1e0baf5f', 'matthew_brennan');