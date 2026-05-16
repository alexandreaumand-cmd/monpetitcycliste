## Objectif

Simplifier la page `SuperAdminLiveBroadcastPage` pour que le workflow soit : **coller une URL → cliquer Importer → voir la situation de course → activer l'auto-refresh**. La situation et la timeline deviennent les éléments centraux. Le composer manuel disparaît. Tout est lisible aussi bien sur desktop que sur mobile.

## Nouveau layout

### Desktop (lg+)
```text
┌──────────────────────────────────────────────────────────────┐
│  ◉ Course active : Giro d'Italia      [Étape 12]   [Archiver]│
│  Sélecteur courses live + ajouter (repliable, compact)        │
├──────────────────────────────────────────────────────────────┤
│  🔗 [URL FirstCycling/PCS ……………………]  [Importer]  [Auto ON]  │
│  ⏱ Dernier : 14:32:05 → Prochain : 14:33:05  · 145/150 ✓    │
├──────────────────────────┬───────────────────────────────────┤
│  SITUATION DE COURSE     │   TIMELINE                        │
│  (grande, focus visuel)  │   (events chronologiques)         │
│  — groupes, écarts, km   │   — chute, échappée, abandon…     │
│                          │                                   │
│  [Diffuser la situation] │   (auto-broadcast actif)          │
└──────────────────────────┴───────────────────────────────────┘
```

### Mobile
- Une seule colonne, ordre vertical :
  1. Barre course active (collapsible : tap pour changer)
  2. Barre import URL + boutons Importer/Auto (sticky en haut quand on scrolle)
  3. Situation de course (pleine largeur)
  4. Timeline (pleine largeur)
- Onglets en haut "Situation | Timeline" si besoin pour éviter le scroll fleuve (à valider à la première itération desktop d'abord).

## Éléments retirés

- **Composer de message manuel** (`MessageInput` + carte Composer) → supprimé.
- **Carte Historique** des messages diffusés → supprimée de la page (on garde quand même l'auto-broadcast en arrière-plan).
- **Planning des plages horaires** → déplacé derrière un bouton ⚙️ discret (popover/sheet), conserve la logique existante.

## Éléments conservés / déplacés

- Sélecteur de course active + ajout/archivage → repliés dans une barre d'en-tête compacte (par défaut fermée si une course est active).
- Sélecteur d'étape (multi-stage) → badge inline dans la barre course active.
- Auto-scrape avec planning → bouton principal "Auto ON/OFF" + lien réglages.
- Stats matching (X/Y) + non matchés → ligne discrète sous la barre d'import.
- Auto-broadcast des événements et de la situation → conservé en arrière-plan (logique inchangée).

## Composants

- Refactor `SuperAdminLiveBroadcastPage.tsx` (desktop par défaut).
- Nouveau `SuperAdminLiveBroadcastPage.mobile.tsx` (même logique, layout mobile).
- Wrapper `SuperAdminLiveBroadcastPage.tsx` qui choisit selon `useIsMobile()` (pattern déjà utilisé ailleurs : `UpcomingCourses.tsx`, `SuperAdminPage.tsx`).
- Extraction d'un sous-composant `LiveImportBar` (URL + Importer + Auto + stats) partagé entre desktop et mobile.
- Extraction d'un sous-composant `ActiveCourseHeader` (course active + étape + switcher repliable).

## Détails techniques

- Fichiers touchés :
  - `src/pages/admin/SuperAdminLiveBroadcastPage.tsx` (wrapper responsive)
  - `src/pages/admin/SuperAdminLiveBroadcastPage.desktop.tsx` (nouveau, contient l'essentiel de la logique actuelle, layout 2 colonnes situation/timeline)
  - `src/pages/admin/SuperAdminLiveBroadcastPage.mobile.tsx` (nouveau, layout vertical + barre import sticky)
  - `src/components/admin/live/LiveImportBar.tsx` (nouveau)
  - `src/components/admin/live/ActiveCourseHeader.tsx` (nouveau)
- Aucune modification de logique métier : `handleScrape`, `broadcastMessage`, `RaceSituationEditor`, `RaceTimeline` restent identiques.
- Aucune modification d'edge function ni de DB.
- Le composer `MessageInput` n'est plus rendu mais `handleSend` reste utilisé par `RaceSituationEditor` (bouton "Diffuser la situation") et l'auto-broadcast.
- Tokens semantic Tailwind uniquement (pas de couleurs en dur).

## Validation

- Test desktop : importer une URL Giro → vérifier 2 colonnes situation/timeline visibles, auto ON met à jour la situation toutes les X secondes.
- Test mobile (393px) : import bar sticky, situation puis timeline empilées, sélecteur de course replié.
