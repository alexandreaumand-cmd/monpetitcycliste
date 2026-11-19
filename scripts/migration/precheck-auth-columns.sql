-- LECTURE SEULE : colonnes auth absentes de la cible, et colonnes générées de la cible.
\pset footer off
\echo '== Colonnes du backup absentes de la cible (doit etre vide)'
SELECT t.tbl, t.col FROM (VALUES
 ('identities','provider_id'),('identities','user_id'),('identities','identity_data'),('identities','provider'),
 ('identities','last_sign_in_at'),('identities','created_at'),('identities','updated_at'),('identities','id'),
 ('users','instance_id'),('users','id'),('users','aud'),('users','role'),('users','email'),('users','encrypted_password'),
 ('users','email_confirmed_at'),('users','invited_at'),('users','confirmation_token'),('users','confirmation_sent_at'),
 ('users','recovery_token'),('users','recovery_sent_at'),('users','email_change_token_new'),('users','email_change'),
 ('users','email_change_sent_at'),('users','last_sign_in_at'),('users','raw_app_meta_data'),('users','raw_user_meta_data'),
 ('users','is_super_admin'),('users','created_at'),('users','updated_at'),('users','phone'),('users','phone_confirmed_at'),
 ('users','phone_change'),('users','phone_change_token'),('users','phone_change_sent_at'),('users','email_change_token_current'),
 ('users','email_change_confirm_status'),('users','banned_until'),('users','reauthentication_token'),
 ('users','reauthentication_sent_at'),('users','is_sso_user'),('users','deleted_at'),('users','is_anonymous')
) AS t(tbl, col)
WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
                  WHERE c.table_schema='auth' AND c.table_name=t.tbl AND c.column_name=t.col);
\echo '== Colonnes de la cible absentes du backup (generees ou nouvelles)'
SELECT table_name, column_name, is_generated, column_default IS NOT NULL AS a_un_defaut, is_nullable
FROM information_schema.columns
WHERE table_schema='auth' AND table_name IN ('users','identities')
  AND column_name NOT IN ('provider_id','user_id','identity_data','provider','last_sign_in_at','created_at','updated_at','id',
   'instance_id','aud','role','email','encrypted_password','email_confirmed_at','invited_at','confirmation_token',
   'confirmation_sent_at','recovery_token','recovery_sent_at','email_change_token_new','email_change','email_change_sent_at',
   'raw_app_meta_data','raw_user_meta_data','is_super_admin','phone','phone_confirmed_at','phone_change','phone_change_token',
   'phone_change_sent_at','email_change_token_current','email_change_confirm_status','banned_until','reauthentication_token',
   'reauthentication_sent_at','is_sso_user','deleted_at','is_anonymous');
