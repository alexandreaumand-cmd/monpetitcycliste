

## Créer les pages du footer et supprimer la section Communauté

Le footer a 3 groupes de liens. L'utilisateur veut supprimer le groupe "Communauté" et créer les pages pour les 2 autres groupes.

### Pages à créer (6 pages)

**Le jeu :**
- `/about` — **À propos** : présentation de La Bordure, l'histoire du projet, l'équipe
- `/rules` — **Règles du jeu** : explication détaillée du scoring, des enchères, du budget, des classements
- `/how-to-play` — **Comment jouer** : guide pas-à-pas pour démarrer (créer une ligue, inviter des amis, enchérir, etc.)

**Légal :**
- `/legal` — **Mentions légales** : éditeur, hébergeur, CNIL
- `/terms` — **CGU** : conditions générales d'utilisation
- `/privacy` — **Confidentialité** : politique de données personnelles

### Changements

1. **Créer un layout partagé `StaticPageLayout.tsx`** — Header (LandingHeader) + Footer (LandingFooter) + contenu centré, réutilisé par toutes les pages statiques.

2. **Créer 6 pages** dans `src/pages/` : `AboutPage.tsx`, `RulesPage.tsx`, `HowToPlayPage.tsx`, `LegalNoticePage.tsx`, `TermsPage.tsx`, `PrivacyPage.tsx`. Contenu en dur (pas d'i18n pour le contenu légal). Style : fond cream, texte structuré avec titres/sections.

3. **`src/App.tsx`** — Ajouter les 6 routes (`/about`, `/rules`, `/how-to-play`, `/legal`, `/terms`, `/privacy`).

4. **`src/components/landing/LandingFooter.tsx`** — Remplacer les `<a href="#">` par des `<Link to="...">`. Supprimer entièrement le bloc "Communauté".

5. **`src/i18n/locales/fr/home.json` et `en/home.json`** — Supprimer les clés `footer.community.*`.

### Contenu des pages

- **À propos** : La Bordure est un jeu de fantasy cycling entre amis. Système d'enchères, courses UCI, classements. Créé par des passionnés.
- **Règles** : Budget initial, fonctionnement des enchères (tours, plus offrant), scoring par étape/classement, classement général/hebdo.
- **Comment jouer** : 4 étapes (créer une ligue → inviter → enchérir → suivre les courses).
- **Mentions légales** : template standard (éditeur La Bordure, hébergeur Lovable).
- **CGU** : conditions d'inscription, propriété intellectuelle, responsabilité.
- **Confidentialité** : données collectées, cookies, droits RGPD.

