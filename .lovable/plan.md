

# Redirection automatique depuis la page d'accueil

## Objectif
Supprimer la page de présentation comme point d'entrée pour les utilisateurs de la PWA et rediriger automatiquement vers :
- **Le dashboard** si l'utilisateur est déjà connecté
- **La page de connexion/inscription** si l'utilisateur n'est pas connecté

## Solution proposée

### Option retenue : Modifier `Index.tsx` pour rediriger automatiquement

C'est la solution la plus simple et la plus propre. On garde la page de présentation dans le code (elle reste accessible via un lien "En savoir plus" sur la page Auth si besoin), mais on redirige immédiatement.

### Fichier à modifier

**`src/pages/Index.tsx`**

Ajouter une redirection automatique dans le `useEffect` existant :

```text
Logique actuelle :
- Vérifie si l'utilisateur est connecté
- Affiche la page de présentation avec un bouton pour aller au dashboard ou à /auth

Nouvelle logique :
- Vérifie si l'utilisateur est connecté
- État de chargement pendant la vérification
- Si connecté → redirection immédiate vers /dashboard/home
- Si non connecté → redirection immédiate vers /auth
```

### Détails techniques

1. Ajouter un état `isLoading` pour gérer le temps de vérification de la session
2. Dans le `useEffect`, après avoir vérifié la session :
   - Si `session` existe → `navigate("/dashboard/home")`
   - Sinon → `navigate("/auth")`
3. Pendant le chargement, afficher un spinner ou écran de chargement avec le logo

### Exemple de flux

```text
Utilisateur ouvre l'app
        ↓
   [Écran de chargement avec logo]
        ↓
   Vérification session Supabase
        ↓
    ┌───────────────────┐
    │                   │
Connecté?           Non connecté?
    │                   │
    ↓                   ↓
/dashboard/home      /auth
```

### Avantages
- Pas de changement dans `App.tsx` (les routes restent les mêmes)
- La page de présentation peut toujours être utilisée pour le SEO ou le marketing
- Transition fluide avec écran de chargement
- Pas de "flash" de contenu

### Conservation de la page de présentation
La page de présentation reste techniquement accessible (ex: via un lien `/landing` si on le souhaite plus tard), mais elle n'est plus le point d'entrée par défaut.

## Impact
- Les utilisateurs de la PWA arrivent directement sur le contenu utile
- Expérience plus fluide, moins de clics
- Pas de régression pour les autres fonctionnalités (invitations, etc.)

