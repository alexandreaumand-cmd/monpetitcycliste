

## Constat

Actuellement, quand un utilisateur s'inscrit via Google (ou Apple), **aucun profil manager n'est créé**. Le profil manager (nom, sponsor) n'est créé que lors de l'inscription par email/mot de passe dans `handleSignUp`. Les utilisateurs OAuth arrivent donc dans l'app sans profil, ce qui casse probablement les fonctionnalités.

## Plan : Suppression du texte de description + Onboarding manager pour OAuth

### 1. Supprimer le texte de description sous le logo
**Fichier** : `src/pages/Auth.tsx`
- Retirer le `<CardDescription>` qui affiche "Connexion réussie !" (quand pas d'invite)

### 2. Créer une page d'onboarding manager
**Nouveau fichier** : `src/pages/CompleteProfile.tsx`
- Page simple avec un formulaire : **Nom du manager** (requis) + **Sponsor** (optionnel)
- Au submit : insertion dans la table `managers` avec le `user_id` de la session
- Redirection vers `/dashboard/home` (ou le `nextUrl` s'il y en a un)

### 3. Rediriger les utilisateurs OAuth sans profil manager
**Fichier** : `src/pages/Auth.tsx`
- Dans le `onAuthStateChange`, après détection de session : vérifier si un profil manager existe
- Si non → rediriger vers `/complete-profile` au lieu du dashboard

**Fichier** : `src/pages/Dashboard.tsx` (ou équivalent)
- Ajouter la même vérification au chargement : si pas de manager → `/complete-profile`

### 4. Ajouter la route
**Fichier** : routing (App.tsx ou équivalent)
- Ajouter la route `/complete-profile` pointant vers `CompleteProfile`

### Traductions
- Ajouter les clés nécessaires dans `fr/auth.json` et `en/auth.json` : `completeProfile.title`, `completeProfile.description`, `completeProfile.submit`

