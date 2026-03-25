
Objectif: rétablir l’affichage des classements de la ligue **MPC 2026** (onglet Classement + cartes “Mes ligues”).

Constat confirmé:
- Les données existent bien en base pour `MPC 2026` (10 lignes dans `v_manager_standings_by_season_v2`).
- Le problème est donc côté **consommation front** (chargement/erreur silencieuse/cache), pas côté calcul de points.

Plan d’implémentation

1) Fiabiliser la récupération des stats des cartes de ligue  
Fichier: `src/hooks/useLeagueCardsData.ts`
- Ne plus conditionner le fetch de `v_manager_standings_by_season_v2` à `currentManagerId`.
  - Aujourd’hui: si `currentManagerId` est null/indisponible, `allStandings` devient `[]` => “Aucune donnée disponible”.
  - Correction: toujours charger les standings par ligue, puis calculer le rang perso seulement si manager courant disponible.
- Ajouter une vraie gestion d’erreur par batch (standings/scopes/seasons/owners), avec fallback explicite, pour éviter les “vides silencieux”.

2) Rendre le composant classement robuste aux erreurs/résultats vides  
Fichier: `src/components/rankings/ManagerStandings.tsx`
- Ajouter `isError`/`error` sur la query standings et afficher un état d’erreur dédié (au lieu d’un tableau vide ambigu).
- Conserver l’état vide uniquement pour “0 ligne réellement retournée”.
- Forcer un refetch fiable sur changement de contexte ligue/saison (éviter de rester bloqué sur un cache vide initial).

3) Aligner le comportement mobile/desktop  
Fichier: `src/pages/Rankings.mobile.tsx`
- Appliquer la même logique d’erreur/empty-state que desktop (sinon écarts de comportement selon device).
- Vérifier que les conditions `enabled` attendent bien les bons identifiants sans figer un état vide.

4) Vérification backend minimale (si erreur de query détectée)  
- Si la query front remonte une erreur d’accès au view, ajouter une migration corrective ciblée:
  - recréer les vues de standings avec options explicites cohérentes,
  - revalider les grants SELECT attendus.
- Pas de refonte SQL des points tant qu’aucune erreur SQL n’est reproduite (les données sont déjà présentes).

5) Validation fonctionnelle ciblée (TEST)
- `/dashboard/classement?leagueId=MPC2026`: lignes managers visibles (plus seulement l’entête).
- `/dashboard/home?leagueId=MPC2026`: carte MPC 2026 affiche au moins leader/rang/points au lieu de “Aucune donnée disponible”.
- Vérifier que les ligues “à la course” restent correctes (pas de régression sur le filtrage par scope).

Détails techniques (résumé)
- Cause la plus probable: logique front trop restrictive + erreurs silencieuses dans les hooks de batch.
- Correctif clé: dissocier “chargement standings de ligue” et “résolution manager courant”, puis exposer explicitement les états `loading / error / empty / data`.
