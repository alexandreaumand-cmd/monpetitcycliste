

## Corriger la langue après connexion Google/Apple

### Problème

Quand un utilisateur est sur la page d'auth en français et clique "Continuer avec Google", il est redirigé vers Google puis revient sur `/complete-profile`. La page peut s'afficher en anglais car :

1. **Clés de traduction manquantes** : `buttons.googleSignIn` et `buttons.appleSignIn` n'existent pas dans les fichiers de traduction — seuls des fallbacks hardcodés sont utilisés
2. **Langue non préservée après le redirect OAuth** : si le détecteur i18next recalcule la langue depuis le navigateur après le retour du redirect, il peut choisir anglais

### Correction

**`src/i18n/locales/fr/auth.json`** et **`en/auth.json`** :
- Ajouter les clés `buttons.googleSignIn` et `buttons.appleSignIn`

**`src/pages/Auth.tsx`** :
- Avant chaque appel `lovable.auth.signInWithOAuth`, sauvegarder explicitement la langue courante dans `localStorage` via `i18n.language` pour s'assurer que `i18nextLng` est bien défini avant le redirect

**`src/pages/CompleteProfile.tsx`** :
- Au montage, lire `i18nextLng` depuis localStorage et forcer `i18n.changeLanguage()` si la langue courante ne correspond pas — pour garantir que la page s'affiche dans la bonne langue après le retour du redirect OAuth

### Fichiers impactés (4)
- `src/i18n/locales/fr/auth.json`
- `src/i18n/locales/en/auth.json`
- `src/pages/Auth.tsx`
- `src/pages/CompleteProfile.tsx`

