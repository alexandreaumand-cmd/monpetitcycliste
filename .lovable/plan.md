# Préparer la saison 2027 à l'avance

Objectif : pouvoir créer la saison 2027 et ses phases dès maintenant, sans qu'elle devienne « saison en cours », puis la lancer manuellement (ou laisser la date la lancer automatiquement, comme aujourd'hui).

## Situation actuelle

- Créer une saison (bouton « Créer la saison ») n'a aucun effet visible ailleurs : une saison sans phase apparaît simplement dans « Saisons à venir ». C'est donc déjà sans risque.
- Le problème vient des phases : le formulaire de création de phase force le statut `active`, même avec des dates futures. Une phase 2027 créée aujourd'hui rendrait immédiatement 2027 « saison en cours » (les indicateurs de phase se basent sur la phase active la plus récente).
- La bascule automatique par date (tâche planifiée) active une phase quand `date_debut <= aujourd'hui <= date_fin` et la termine après `date_fin`. Une phase 2027 avec des dates 2027 ne serait donc pas activée avant l'heure — à condition de ne pas être créée « active » à la main.

## Ce qui sera mis en place

### 1. Création de phases en brouillon
- Le formulaire de création de phase crée désormais la phase en statut **Brouillon** par défaut (choix possible : Brouillon / Active).
- Chaque phase brouillon affiche un bouton **« Lancer la phase »** (passage en active) et un bouton pour revenir en brouillon si lancée par erreur.
- La bascule automatique à la date est conservée telle quelle : une phase brouillon dont la date de début arrive passera automatiquement en active.

### 2. Affichage « saison à venir » fiable
- Une saison dont toutes les phases sont en brouillon est classée dans « Saisons à venir » (aujourd'hui elle basculerait en « en cours »).
- Badges de statut par phase : Brouillon / Active / Terminée, avec les dates.

### 3. Duplication des données depuis 2026
Nouveau bloc « Préparer une saison » dans l'onglet Saisons, avec saison source (2026) et saison cible (2027), et trois cases à cocher indépendantes :
- **Équipes** : copie des équipes de la saison (nom affiché, catégorie, trigramme, actif).
- **Barèmes** : copie des règles de points de la saison.
- **Coureurs** : copie des rattachements coureur/équipe et prix initiaux (à ajuster ensuite via l'import habituel ou l'écran Coureurs).

Chaque copie est idempotente (relancer n'ajoute pas de doublons) et affiche le nombre de lignes créées / ignorées.

## Procédure à suivre ensuite (résumé pour vous)

1. Onglet Saisons → « Créer la saison 2027 ».
2. Bloc « Préparer une saison » → source 2026, cible 2027, cocher Équipes + Barèmes (+ Coureurs), lancer.
3. Ajuster les coureurs et prix 2027 (import CSV / écran Coureurs).
4. Créer les phases 2027 avec leurs dates et budgets — elles restent en **Brouillon**.
5. Créer les courses de chaque phase, planifier les enchères si besoin.
6. Le jour J : soit cliquer sur « Lancer la phase », soit laisser la bascule automatique le faire à la date de début.

## Détails techniques

- `src/components/admin/SeasonManager.tsx` : statut par défaut `draft` à l'insertion de phase, sélecteur de statut, actions Lancer / Remettre en brouillon, catégorisation « à venir » basée sur l'absence de phase active, badges de statut.
- Nouveau composant `src/components/admin/SeasonPrepareManager.tsx` monté dans l'onglet Saisons.
- Nouvelle fonction SQL `clone_season_data(p_source_saison uuid, p_target_saison uuid, p_equipes bool, p_baremes bool, p_coureurs bool)` (SECURITY DEFINER, réservée aux super-admins) qui insère dans `equipes_saisons`, `scoring_rules_saisons` et `coureurs_saisons` avec `ON CONFLICT DO NOTHING`, et renvoie le décompte par table.
- Aucun changement de la tâche planifiée `auto_update_phase_statuts` (comportement automatique conservé).
