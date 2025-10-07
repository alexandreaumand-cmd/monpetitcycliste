-- Rattacher l'utilisateur emmanuelbenoit2404@gmail.com au manager Manou
UPDATE managers 
SET user_id = '1b6d1934-31bc-4193-a78d-be43af523574'
WHERE id = 'd86b7204-f19f-4fa3-8321-cc20ef17af3e';

-- Ajouter le rôle admin pour cet utilisateur
INSERT INTO user_roles (user_id, role)
VALUES ('1b6d1934-31bc-4193-a78d-be43af523574', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;