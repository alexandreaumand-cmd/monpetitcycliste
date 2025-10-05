
-- Associer l'utilisateur matthieu.beauvillard@gmail.com au manager Matt B
UPDATE managers 
SET user_id = '78efd309-2303-4e62-b8f0-66895811ffbc'
WHERE id = 'fc1f58a4-ec7f-49c3-ab7a-62f9b2ada9ea';

-- Ajouter le rôle admin à l'utilisateur
INSERT INTO user_roles (user_id, role)
VALUES ('78efd309-2303-4e62-b8f0-66895811ffbc', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
