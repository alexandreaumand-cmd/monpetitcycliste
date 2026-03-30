

## Remplacer le bouton "Installer" par "Rejoindre une ligue" dans le Hero

### Modification

**`src/components/landing/HeroSection.tsx`** :
- Remplacer le bouton "Install" (lien vers `/install`, icone `Download`) par un bouton "Rejoindre une ligue" avec l'icone `Users` (lucide-react), lien vers `/auth`
- Ajouter les clés de traduction `hero.cta.joinLeague` dans les fichiers FR et EN

### Fichiers impactés (3)
- `src/components/landing/HeroSection.tsx`
- `src/i18n/locales/fr/home.json` — ajouter `hero.cta.joinLeague: "Rejoindre une ligue"`
- `src/i18n/locales/en/home.json` — ajouter `hero.cta.joinLeague: "Join a league"`

