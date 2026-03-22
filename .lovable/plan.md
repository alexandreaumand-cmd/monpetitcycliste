
Objectif: rendre l’écran “Calendrier → détail course” lisible en séparant clairement 2 notions différentes:
1) confirmation officielle PCS (tick vert équipe),
2) matching interne (matched/unmatched dans la base).

Constat (vérifié):
- En LIVE, la Volta a bien des données de confirmation (161 partants, 119 avec `team_confirmed=true`, 17 équipes confirmées).
- Le composant actuel affiche un check par ligne basé sur `coureur_id` (matching), pas sur confirmation officielle.
- Le payload utilisé par le drawer ne renvoie pas explicitement `team_confirmed` au frontend.
- Les compteurs “matched/unmatched” sont affichés sans libellés clairs, ce qui crée la confusion.

Plan d’implémentation

1) Corriger le payload backend du drawer calendrier
- Fichier: `supabase/functions/startlist-entries-list/index.ts`
- Ajouter `team_confirmed` dans la sélection des `startlist_entries`.
- Retourner un objet d’entrée cohérent avec le frontend (`coureur`, `equipe`, `team_confirmed`, `is_matched`) pour éviter l’ambiguïté.
- Étendre `stats` avec:
  - `matched`, `unmatched` (existant),
  - `confirmed_riders`,
  - `confirmed_teams`,
  - `total_teams`.

2) Refonte UX du bloc “Coureurs inscrits” dans le drawer
- Fichier: `src/components/calendar/CalendarCourseDialog.tsx`
- Remplacer les compteurs icon-only par des badges textuels explicites:
  - “X coureurs matchés”
  - “Y non matchés”
  - “Z/W équipes confirmées officiellement”
- Ajouter une légende explicite sous le titre:
  - “✓ vert = composition officielle PCS”
  - “⚠ = coureur non matché dans la base”
- Dans les listes:
  - afficher le pictogramme “confirmation officielle” (team_confirmed) près du nom équipe/coureur,
  - réserver l’alerte uniquement aux entrées non matchées,
  - ne plus utiliser le même pictogramme vert pour le matching (source de confusion actuelle).

3) Clarifier l’affichage par équipe
- Toujours dans `CalendarCourseDialog.tsx`
- Au niveau de l’en-tête équipe:
  - badge “Équipe confirmée” si l’équipe est confirmée,
  - badge neutre sinon (ou rien selon densité visuelle).
- Conserver le regroupement par équipe actuel mais avec statut officiel visible au niveau équipe (plus naturel car le tick PCS est un signal d’équipe).

4) Traductions FR/EN
- Fichiers:
  - `src/i18n/locales/fr/calendar.json`
  - `src/i18n/locales/en/calendar.json`
- Ajouter des clés dédiées:
  - `drawer.confirmedTeams`,
  - `drawer.confirmedRiders`,
  - `drawer.matchedRiders`,
  - `drawer.unmatchedRiders`,
  - `drawer.legendOfficial`,
  - `drawer.legendMatching`.

5) Validation fonctionnelle
- Vérifier sur “Volta Ciclista a Catalunya” en LIVE:
  - présence visible des confirmations officielles (équipes/coureurs),
  - distinction claire avec matched/unmatched.
- Vérifier un cas avec unmatched > 0 (autre course) pour confirmer la signalétique d’alerte.
- Vérifier responsive (desktop + mobile drawer) et absence de régression “no startlist”.

Détails techniques (résumé)
- Aucun changement de schéma SQL requis.
- Le correctif est 100% côté payload edge function + UI + i18n.
- L’objectif est de dissocier visuellement “qualité de mapping interne” et “validation officielle PCS”, qui sont deux statuts indépendants.
