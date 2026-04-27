## Objectif

Sur la page **Données Coureurs** (`/data`) :
1. Réorganiser les filtres pour gagner de la place et améliorer la lisibilité (desktop + mobile).
2. Ajouter un **nouveau filtre « Courses »** multi-sélection avec recherche textuelle. Quand une ou plusieurs courses sont sélectionnées, la liste se restreint aux coureurs présents sur la **startlist** de ces courses.

## Refonte UI des filtres

### Desktop
Aujourd'hui : grille à 6 colonnes mélangeant Recherche, Équipe, Catégorie, **Cotes (gros bloc scroll)**, Programme, Favoris, Reset/Excel — provoque des trous visuels (cf. capture).

Après :
- **Barre principale (1 ligne)** : Recherche (large) · Équipe · Catégorie · **Courses (nouveau)** · Programme · Favoris uniquement (toggle compact).
- **Cotes** déplacées dans un **Popover compact** (bouton "Cotes (n)" qui ouvre la liste à cocher actuelle). Plus de gros bloc scrollable inline.
- **Actions à droite** sur la même ligne que le compteur de résultats : `Réinitialiser` + `Excel`. Ils ne consomment plus une cellule de grille.
- Compteur "X coureurs affichés (sur Y)" + chips des filtres actifs cliquables pour les retirer rapidement.

### Mobile
- Garder Recherche toujours visible.
- Bouton "Filtres" déjà existant : ajouter le nouveau filtre Courses dans le `Collapsible`, au-dessus de Programme.
- Cotes restent dans le collapsible (déjà compact en mobile).

## Nouveau filtre « Courses »

### UI
- Composant : combobox multi-sélection avec recherche (réutiliser `src/components/ui/multi-select.tsx` ou un `Popover` + `Command` à la `CoureursCombobox`).
- Placeholder : "Filtrer par course…".
- Liste déroulante avec recherche textuelle (input en haut), résultats triés par date.
- Affichage des courses sélectionnées sous forme de **badges** retirables.
- Compteur "(n)" sur le déclencheur.

### Source de données
- Reprendre exactement la logique de récupération de `programData` déjà présente dans `RidersData.tsx` (table `startlist_entries` jointe à `startlist_imports` + `courses`, scopée à `localSelectedSeason.id`, paginée).
- En extraire deux structures :
  1. `riderRacesMap` (déjà calculé, conservé tel quel pour l'affichage du programme).
  2. `raceToRidersMap: Map<race_id, Set<coureur_id>>` reconstruite dans la même `useQuery` (un seul fetch, deux index).
- Liste des courses du filtre : `Array<{ id, nom, date_debut }>` distincte issue du même fetch, triée par `date_debut` croissant. Pas de fetch supplémentaire.
- Inclure **toutes les courses qui ont une startlist importée pour la saison sélectionnée** (passées + à venir), pas seulement les courses futures. → Adapter la requête : retirer le `gte("date_debut", today)` pour le set "courses du filtre"; conserver le filtre `today` uniquement pour le calcul "Programme à venir" (déjà utilisé pour le filtre Programme et l'affichage).
  - Implémentation : faire **deux** index dans la même boucle, l'un sans filtre date pour `raceToRidersMap`, l'autre filtré `>= today` pour `riderRacesMap` (programme).
  - La requête actuelle a `.gte("startlist_imports.courses.date_debut", today)` → la retirer et appliquer le filtre date côté client uniquement pour `riderRacesMap`.

### État & filtrage
- Nouvel état : `const [selectedCourses, setSelectedCourses] = useState<string[]>([])`.
- Dans `filteredRiders`, ajouter :
  ```ts
  if (selectedCourses.length > 0) {
    const ridersInCourses = new Set<string>();
    for (const cid of selectedCourses) {
      const set = raceToRidersMap.get(cid);
      if (set) set.forEach(r => ridersInCourses.add(r));
    }
    if (!ridersInCourses.has(rider.coureur_id)) return false;
  }
  ```
  → Logique **OU** (un coureur présent sur l'une des courses sélectionnées). À confirmer si l'utilisateur préfère ET (intersection).
- Inclus dans `Réinitialiser` et dans le compteur de filtres actifs (mobile + desktop).

## Fichiers impactés

- `src/pages/RidersData.tsx` : refonte du bloc filtres desktop + mobile, ajout état + filtrage Courses, ajout `raceToRidersMap` et `coursesList` dans `useQuery` `riders-program`, popover Cotes.
- `src/i18n/locales/fr/data.json` & `en/data.json` : nouvelles clés `filters.courses`, `filters.coursesPlaceholder`, `filters.coursesAll`.
- Aucune nouvelle table, aucune Edge Function, aucun changement DB.

## Question ouverte (à confirmer après lecture du plan)

- Si plusieurs courses sont sélectionnées, faut-il afficher les coureurs présents sur **au moins une** (OU, défaut proposé) ou sur **toutes** (ET) ? Je pars sur OU sauf indication contraire.
