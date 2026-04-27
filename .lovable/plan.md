## Objectif

Améliorer la modale "Course" du Calendrier (`CalendarCourseDialog.tsx`) avec deux évolutions :

1. **Derniers mouvements de startlist** affichés dans l'espace libre à gauche (sous Points/Bareme/Route), condensés et lisibles. Sur mobile, en bas de page, repliables dans un accordéon.
2. **Étoile favoris** à côté de chaque coureur de la startlist, même comportement que `RidersData` (table `rider_favorites`, toggle, jaune si favori).

---

## 1. Mouvements startlists (colonne gauche desktop, bas en mobile)

**Données** : table `startlist_tracker_changes` filtrée sur `course_id = course.course_id`, ordre `detected_at DESC`, limite 30 (suffisant pour une seule course, condensé).

**Requête** (nouveau `useQuery` dans `CalendarCourseDialog.tsx`) :
```ts
supabase
  .from("startlist_tracker_changes")
  .select("id, change_type, rider_name, team_name, coureur_id, detected_at")
  .eq("course_id", course.course_id)
  .order("detected_at", { ascending: false })
  .limit(30);
```

Fallback équipe : si `team_name` est `null` mais `coureur_id` présent, résoudre via `coureurs_saisons` + `equipes_saisons` (même logique que `StartlistTrackerMovements.tsx`, ligne 96-130) sur la saison courante (`useSeasonContext`).

**Rendu condensé** — nouveau sous-composant local `StartlistMovementsCompact` :
- En-tête : icône `ArrowDownUp` + libellé `Mouvements startlist` + badge count.
- Lignes : icône Ajout (vert `Plus`) / Retrait (rouge `Minus`) + nom coureur (font-medium) + équipe (text-muted, truncate) + date relative `dd MMM HH:mm`.
- Layout : `space-y-1`, `text-xs`, `py-1 px-2 rounded hover:bg-muted/50`.
- Si zéro mouvement : message discret `Aucun mouvement détecté`.
- Scroll vertical max-h-[280px] sur desktop pour ne pas pousser le contenu.

**Placement responsive** :
- **Desktop (`lg:`)** : intégré dans la colonne gauche existante (ligne 260, sous la route image), sans accordéon (toujours visible).
- **Mobile (`< lg`)** : déplacé en bas de la grille, dans un `<Collapsible>` (déjà importé) avec trigger `Mouvements startlist (N)` + `ChevronDown/Up`. Pour ça : on rend deux instances conditionnelles (`hidden lg:block` à gauche / `lg:hidden` en bas après la startlist), ou plus propre : un seul bloc rendu deux fois selon breakpoint via `useIsMobile`.

Choix retenu : **un seul bloc rendu** dans la colonne gauche pour desktop (toujours déplié), et dupliqué en bas du grid sur mobile dans un Collapsible. Les deux utilisent la même donnée (même queryKey, partagée via React Query cache).

---

## 2. Étoile favoris sur chaque coureur

**Pré-requis** :
- Récupérer `managerId` via `useCurrentManager()` (déjà utilisé ailleurs).
- Charger les favoris du manager au montage (queryKey `["rider-favorites", managerId]`) :
  ```ts
  supabase.from("rider_favorites").select("coureur_id").eq("manager_id", managerId)
  ```
  → `Set<string>` de `coureur_id` favoris.

**Mutation** : copier exactement le pattern de `RidersData.tsx` (lignes 397-425) — `useMutation` qui insert/delete dans `rider_favorites`, invalide `["rider-favorites", managerId]`.

**Modification de `RiderRow`** (ligne 52-67) :
- Ajouter props `isFavorite: boolean`, `onToggleFavorite: () => void`, `canFavorite: boolean` (false si pas de `coureur_id` matché ou pas de manager).
- Ajouter en fin de ligne un `<button>` icône `Star` :
  ```tsx
  <Star className={cn("h-3.5 w-3.5", isFavorite ? "fill-yellow-400 text-bordure-gold" : "text-muted-foreground/50")} />
  ```
- `e.stopPropagation()` au clic pour éviter conflits.
- Si `!canFavorite` (coureur non matché en base ou pas connecté) → ne pas afficher l'étoile.

Propager `favoritesSet`, `toggleFavorite`, `managerId` depuis `CalendarCourseDialog` jusqu'aux `RiderRow` (via les deux colonnes du grid d'équipe).

---

## Fichiers modifiés

- `src/components/calendar/CalendarCourseDialog.tsx` — ajout des deux queries (mouvements + favoris), mutation toggleFavorite, sous-composant `StartlistMovementsCompact`, modification de `RiderRow` (étoile), placement responsive (desktop colonne gauche + mobile bas en accordéon).
- `src/i18n/locales/fr/calendar.json` et `en/calendar.json` — nouvelles clés : `drawer.movements.title`, `drawer.movements.added`, `drawer.movements.removed`, `drawer.movements.empty`, `drawer.movements.detected`.

Aucune migration DB nécessaire (tables `startlist_tracker_changes` et `rider_favorites` existent déjà).
