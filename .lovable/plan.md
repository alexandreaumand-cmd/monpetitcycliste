

# Mise à jour de la page Règles du Jeu

## Objectif
1. Ajouter une section décrivant les **types de ligues** (5 Phases, A la course)
2. Harmoniser l'affichage des barèmes pour **toutes les catégories de courses** en utilisant le format condensé des Grands Tours (tableaux GC + Etape + Maillots/Porteurs dans un même accordion)
3. Ajouter les données manquantes : points porteurs (Porteur Leader, Vert, Montagne, Jeune, Combattif), championnats nationaux

## Changements prévus

### 1. Nouvelle section "Types de ligues" (entre section 1 et section 2)

Ajout d'une section **"2. Les types de ligues"** (les sections suivantes seront renumérotées) avec deux cartes :

- **5 Phases** : Budget 2200, effectif 30 coureurs, saison complète divisée en 5 phases d'enchères. Variante "WT only" disponible.
- **A la course** : Sélection libre de courses, budgets dynamiques selon le nombre/type de courses (1 classique : 650/8, plusieurs classiques : 800/10, course par étapes : 1100/15).

### 2. Harmonisation des barèmes — Format condensé unifié

Chaque catégorie de course par étapes affichera dans son accordion :
- **Tableau GC** (top 15) en grille compacte
- **Tableau Etape** (top 10) en grille compacte  
- **Tableau Maillots finals** : Vert, Montagne, Jeune, Combatif avec tous les places
- **Tableau Porteurs** : Porteur Leader, Porteur Vert, Porteur Montagne, Porteur Jeune, Porteur Combattif (points par jour)

Le tout dans un layout **condensé** avec des grilles horizontales (comme le composant `PointsBaremeSection` dans le calendrier) plutôt que de longues listes textuelles.

**Catégories concernées :**
- Grands Tours (WT GT) — déjà bien mais à compléter avec Porteurs
- Tours WT Cat 1, 2, 3 — passer du format texte au format tableaux
- Tours .Pro (2.pro) et .1 (2.1) — idem
- Courses d'un jour — garder le format actuel (simple GC)

### 3. Données complètes depuis la base

Toutes les valeurs seront alignées sur la base de données (saison 2026). Points notables à ajouter :

**Grands Tours — données manquantes actuellement :**
- Porteur Leader : 20 pts/jour
- Porteur Vert : 12 pts/jour
- Porteur Montagne : 12 pts/jour
- Porteur Jeune : 6 pts/jour
- Porteur Combattif : 12 pts/jour
- Combatif final : 150 pts

**Championnats Nationaux** (nouvelle sous-section) :
- CN Route Cat 1-4 et CN CLM Cat 1-4

### 4. Composant `CompactBareme`

Nouveau composant interne pour afficher un barème en **grille compacte** (comme dans `PointsBaremeSection`) : chaque place est une petite carte avec le rang en haut et les points en dessous. Beaucoup plus lisible et condensé que les tableaux verticaux actuels.

### Fichier modifié
- `src/pages/RulesPage.tsx` — refonte complète de la structure

### Structure finale des sections
1. Principe général
2. **Les types de ligues** (NOUVEAU)
3. Les enchères
4. Le scoring (barèmes harmonisés)
5. Les bonus
6. Le classement
7. Courses prises en compte

