
## Ajout d'un tableau des mouvements startlist sous le calendrier

### Objectif
Ajouter, sous le calendrier de la page Startlist (desktop et mobile), un tableau des derniers mouvements de startlists (ajouts/retraits) pour les courses de la phase en cours. Les mouvements sont regroupes par course dans des accordeons.

### Source de donnees
- Table `startlist_tracker_changes` : contient `change_type`, `rider_name`, `team_name`, `course_name`, `course_id`, `coureur_id`, `detected_at`
- Table `rosters` : jointure sur `coureur_id` pour retrouver le `manager_id`, puis `managers.nom` pour le nom du manager
- Table `courses` : filtrer par `phase_id` = phase en cours
- La phase en cours est deja disponible via `useSeasonContext()` (tableau `phases`)

### Nouveau composant : `src/components/startlist/StartlistTrackerMovements.tsx`

**Props** : `phaseId: string`, `leagueId: string`

**Donnees** :
1. Recuperer les `course_id` de la phase en cours depuis `courses` (filtre `phase_id`)
2. Recuperer les changements depuis `startlist_tracker_changes` filtres par ces `course_id`, ordonnees par `detected_at` desc
3. Recuperer les rosters de la ligue pour mapper `coureur_id` -> `manager_nom` (via `rosters` + `managers`)

**Affichage** :
- Titre "Mouvements startlists" avec une icone
- Accordeons regroupes par course (`course_name`)
- Chaque accordeon affiche le nom de la course + le nombre de changements entre parentheses
- Dans chaque accordeon, un tableau compact avec les colonnes :
  - **Type** : badge vert "Ajout" / badge rouge "Retrait"
  - **Coureur** : `rider_name`
  - **Equipe** : `team_name`
  - **Manager** : nom du manager (si le coureur est dans un roster de la ligue, sinon "-")
  - **Detecte** : date formatee "dd MMM HH:mm"
- Si aucun mouvement, afficher un message "Aucun mouvement"

### Integration

**Desktop (`Startlist.desktop.tsx`)** :
- Ajouter le composant sous le `StartlistCalendarView` (ou sous le grid de cartes) dans le mode `list`
- Determiner la phase en cours : la premiere phase dont `date_debut <= today <= date_fin`, ou a defaut la prochaine phase

**Mobile (`Startlist.mobile.tsx`)** :
- Ajouter le composant sous le calendrier / liste dans le mode `list`
- Meme logique de phase en cours

### Details techniques

- Utiliser `useQuery` pour les 3 requetes (courses de la phase, changements, rosters)
- Utiliser les composants existants : `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`, `Badge`, `Table`
- La requete rosters necessite une jointure : `rosters` filtre par `league_id` pour mapper `coureur_id` -> `manager_id`, puis `managers` pour le nom
- Grouper les changements par `course_id` cote client avec un `useMemo`
- Limiter a 200 changements pour la performance
