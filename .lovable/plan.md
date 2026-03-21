

## Refonte de la page Règles du jeu

Réécriture complète de `src/pages/RulesPage.tsx` avec du contenu vérifié (basé sur les données réelles de la base) et une mise en page graphique.

### Contenu enrichi et vérifié

**1. Principe general** — Inchangé mais reformulé plus clairement.

**2. Les encheres** — Enrichi :
- Budget fixe identique pour tous les managers
- Tours successifs avec deadline
- En cas d'egalite : tirage au sort (pas premier arrive)
- Strategie budgetaire

**3. Le scoring** — Section majeure, etoffee avec des donnees reelles :
- Courses d'un jour (Classiques) : points au general uniquement, top 15
  - Monuments (Cat 1) : 800 → 40 pts
  - Cat 2 : 550 → 30 pts  
  - Cat 3 : 350 → 15 pts
- Courses par etapes (Tours) : points etape + general + maillots
  - Grands Tours (WT GT) : etape top 10, general top 10, maillots
  - Tours WT Cat 1/2/3 : baremes degressifs
- Championnats (nationaux, europeens, mondiaux) : CLM + route
- Maillots distinctifs : Porteur Leader, Vert, Montagne, Jeune, Combattif — points par etape portee
- Courses .1 et .Pro : general top 10

**4. Les bonus** — Nouvelle section :
- Bonus Coureur : +25% sur la premiere victoire d'un coureur (CLM individuel inclus)
- Bonus Manager : CLM par equipe, Nombre de scoreurs (coureurs ayant marque au moins 1 point)

**5. Les classements** — Simplifie : classement general uniquement (pas d'hebdo confirme par l'utilisateur)

**6. Courses prises en compte** — Liste des categories reelles : WT GT, Monuments, Classiques WT, Tours WT, ProSeries, courses .1, Championnats

### Mise en page graphique

- Chaque section dans une **carte blanche** (`bg-white rounded-xl shadow border`) comme sur HowToPlayPage
- **Icones Lucide** pour chaque section (Trophy, Gavel, Target, Gift, BarChart, Calendar)
- **Bandes decoratives** BordureStripes entre sections
- **Tableaux de points** stylises pour le scoring (pas du texte brut) — tableau compact avec fond alterne
- **Accordions** pour les baremes detailles par categorie (evite une page trop longue)
- Couleurs alternees or/rose sur les numeros de section
- **CTA en bas** vers la page Auth comme sur HowToPlayPage

### Fichier impacte

- `src/pages/RulesPage.tsx` — reecriture complete

