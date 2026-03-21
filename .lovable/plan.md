

## Fonctionnalité "Mot de passe oublié"

### Ce qui existe déjà
- Un reset admin via l'edge function `admin-user-reset-password` (réservé aux super-admins)
- Aucune page `/reset-password` pour l'utilisateur final
- Aucun lien "Mot de passe oublié" sur la page Auth

### Ce qu'il faut créer

#### 1. Lien "Mot de passe oublié" sur la page Auth
- Ajouter un lien cliquable sous le formulaire de connexion (onglet "Sign In") dans `src/pages/Auth.tsx`
- Au clic, afficher un petit formulaire demandant l'email, puis appeler `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })`
- Afficher un message de confirmation ("Un email de réinitialisation a été envoyé")

#### 2. Page `/reset-password`
- Créer `src/pages/ResetPassword.tsx` — page publique avec un formulaire "Nouveau mot de passe"
- Détecter le token de récupération dans l'URL (hash `type=recovery`)
- Appeler `supabase.auth.updateUser({ password })` pour enregistrer le nouveau mot de passe
- Rediriger vers `/dashboard/home` après succès

#### 3. Route dans App.tsx
- Ajouter `<Route path="/reset-password" element={<ResetPassword />} />`

#### 4. Traductions i18n
- Ajouter dans `fr/auth.json` et `en/auth.json` les clés :
  - `buttons.forgotPassword` → "Mot de passe oublié ?" / "Forgot password?"
  - `messages.resetEmailSent` → "Email de réinitialisation envoyé" / "Reset email sent"
  - `resetPassword.title`, `resetPassword.newPassword`, `resetPassword.confirm`, `resetPassword.success`

#### 5. Emails de réinitialisation
Le domaine email `notify.labordure.app` est configuré mais le DNS n'est pas encore vérifié. Les emails de réinitialisation seront envoyés par le système par défaut en attendant. Une fois le DNS vérifié, on pourra personnaliser les templates email si souhaité.

### Fichiers impactés
- `src/pages/Auth.tsx` — ajout lien + mini-formulaire "mot de passe oublié"
- `src/pages/ResetPassword.tsx` — **nouveau fichier**
- `src/App.tsx` — ajout route `/reset-password`
- `src/i18n/locales/fr/auth.json` — nouvelles clés
- `src/i18n/locales/en/auth.json` — nouvelles clés

