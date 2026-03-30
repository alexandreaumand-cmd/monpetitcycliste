

## Onboarding Wizard — Guide interactif des onglets

### Concept

Un overlay "coach marks" qui s'affiche a la premiere connexion. Chaque etape met en surbrillance un element de la sidebar (desktop) ou de la bottom bar (mobile) avec une bulle explicative. L'utilisateur clique "Suivant" pour passer d'un onglet a l'autre, puis "Terminer" pour fermer.

### Approche technique

**1. Tracking "deja vu"** — Table `onboarding_progress` en base

| Colonne | Type |
|---------|------|
| user_id | uuid (PK, ref auth.users) |
| completed_at | timestamptz |

A la premiere connexion, si aucune ligne n'existe pour l'utilisateur, le wizard se lance. Une fois termine, on insere une ligne.

**2. Composant `OnboardingWizard`** — Nouveau fichier `src/components/onboarding/OnboardingWizard.tsx`

- Recoit la liste des etapes (icon, titre, description pour chaque onglet de `navItemsConfig`)
- Utilise un state `currentStep` (0 a N)
- Chaque etape affiche un **Dialog/overlay** centre avec :
  - L'icone de l'onglet + son nom
  - Une description courte (1-2 phrases) de ce qu'on y trouve
  - Boutons "Precedent / Suivant / Passer"
- A la derniere etape : bouton "C'est parti !"

**3. Donnees des etapes** — Nouveau fichier `src/components/onboarding/onboardingSteps.ts`

```text
Classement   → Suis ton classement et celui de tes adversaires en temps reel
Mon equipe   → Gere ton effectif, consulte tes coureurs et leurs stats
Resultats    → Retrouve les resultats des courses et les points marques
Courses      → Decouvre les prochaines courses au calendrier
Startlist    → Compose ta selection de coureurs pour les prochaines courses
Statistiques → Analyse tes performances avec des graphiques detailles
Encheres     → Recrute de nouveaux coureurs aux encheres
Live         → Suis les courses en direct
Arene        → Defie d'autres managers en duel
```

**4. Integration**

- Dans `Dashboard.tsx`, apres le chargement du manager, requeter `onboarding_progress` pour l'utilisateur courant
- Si pas de ligne → afficher `<OnboardingWizard />` en overlay au-dessus du layout
- Au clic "Terminer" → insert dans `onboarding_progress` + fermer
- Fonctionne sur desktop et mobile (Dialog responsive)

**5. Option "Revoir le tuto"**

- Ajouter un bouton dans la page Compte (`AccountPage`) pour relancer le wizard (supprime la ligne `onboarding_progress`)

### Fichiers concernes

| Action | Fichier |
|--------|---------|
| Create | `src/components/onboarding/OnboardingWizard.tsx` |
| Create | `src/components/onboarding/onboardingSteps.ts` |
| Migration | Table `onboarding_progress` + RLS |
| Edit | `src/pages/Dashboard.tsx` (afficher le wizard) |
| Edit | `src/pages/AccountPage.tsx` (bouton "Revoir le tuto") |

