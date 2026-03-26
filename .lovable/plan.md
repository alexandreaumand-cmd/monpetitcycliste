

## Enrichir l'étape de sélection des courses

### Problème
Le sélecteur de courses n'offre qu'un filtre par type (Étapes/1 jour) et un tri chronologique. Il manque :
- Un filtre par catégorie (WT, .Pro, .1, Autres)
- Le nombre de points à gagner par course
- Un tri par points décroissants (en plus du tri chronologique)

### Source de données
La vue `v_course_points_theoriques` contient `course_id`, `points_total`, `categorie`, `saison_id`. On fera une jointure côté client avec les courses chargées.

### Modifications — `src/components/leagues/CourseSelector.tsx`

**1. Fetch des points théoriques**
Ajouter une requête sur `v_course_points_theoriques` filtrée par `saison_id` pour récupérer `course_id` et `points_total`. Créer un `Map<courseId, points_total>` pour enrichir l'affichage.

**2. Filtre par catégorie**
Ajouter un state `categoryFilter` avec les groupes : `WT`, `.Pro`, `.1`, `Autres`. Logique de groupement :
- `WT` : categorie contient "WT", "GT" ou "Monument"
- `.Pro` : categorie contient ".pro" (insensible à la casse)
- `.1` : categorie contient ".1"
- `Autres` : tout le reste

Afficher comme badges cliquables à côté des filtres type existants (sur une ligne séparée pour ne pas surcharger le mobile).

**3. Tri (sort)**
Ajouter un state `sortMode: 'date' | 'points'` (défaut : `date`). Deux boutons de tri :
- 📅 Date (chronologique ascendant — comportement actuel)
- 🏆 Points (décroissant)

**4. Affichage des points**
Dans chaque ligne de course, ajouter un badge doré affichant le nombre de points théoriques total (ex: `3 775 pts`).

### Résultat attendu
- Filtre catégorie fonctionnel (WT / .Pro / .1 / Autres)
- Tri par date ou par points
- Points affichés sur chaque course
- Rendu mobile propre (badges sur 2 lignes si nécessaire)

### Fichier impacté
- `src/components/leagues/CourseSelector.tsx` uniquement

