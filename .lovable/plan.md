

## Créer la page "L'Équipe" avec les 10 fondateurs

### Nouvelle page `/team`

Créer `src/pages/TeamPage.tsx` avec le layout `StaticPageLayout`. La page affiche les 10 membres fondateurs dans une grille responsive (2 colonnes mobile, 3-4 desktop).

Chaque membre est une carte avec :
- Un **placeholder circulaire** stylisé (icône générique colorée, en attendant les vraies photos transformées en illustrations)
- Son **surnom** en gros (ex: "L'Ayatollah")
- Sa **description** courte et humoristique

Les surnoms et descriptions sont en dur (pas d'i18n, contenu identitaire français).

### Les 10 membres

| Surnom | Description |
|--------|-------------|
| L'Ayatollah | Celui qui a créé un fichier de 100Mo pour gérer le jeu et qui en a créé les règles |
| Le Pape de la Data | Il a compilé toutes les données du cyclisme depuis 50 ans |
| Le Criminel Écologique | Il arpente l'Europe pour aller repérer les coureurs en devenir |
| Le Sachant | Il connaît tout sur tout, imbattable au quizz |
| Le Rappeur | Le plus créatif de la bande, fan de baies vitrées |
| Le Doc | On sait toujours pas trop ce qu'il farfouille, mais il gagne 5 phases d'affilé. Louche. |
| La Pépite | Il s'est essayé au football. Barré par Mvila, il suit maintenant le vélo |
| Le BOSS | Il a renversé la table et a pris le pouvoir |
| Le Codeur | Il débug, fait évoluer, c'est lui qui tient la barre |
| Le Fantôme | Plus occupé à bouffer des frites à la cantine qu'à suivre le vélo |

### Style visuel

- Fond cream, cartes avec bordure subtle et hover gold
- Placeholder avatar : cercle coloré avec une icône Lucide correspondant au personnage (Gavel pour l'Ayatollah, Database pour le Pape, Globe pour le Criminel, etc.)
- Alternance subtile gold/pink sur les icônes (cohérent avec la charte)
- Titre de page : "L'Équipe" avec un sous-titre type "Les 10 passionnés derrière La Bordure"

### Fichiers impactés

1. **`src/pages/TeamPage.tsx`** (nouveau) — La page complète avec grille de membres
2. **`src/App.tsx`** — Ajout route `/team` (lazy loaded)
3. **`src/components/landing/LandingFooter.tsx`** — Ajout lien "L'Équipe" dans le groupe "Le jeu"
4. **`src/i18n/locales/fr/home.json`** et **`en/home.json`** — Ajout clé `footer.game.team`

Les placeholders d'avatar seront ensuite remplaçables par les photos stylisées une fois fournies.

