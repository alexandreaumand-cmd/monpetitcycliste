# 3 propositions d'amélioration

Trois pistes indépendantes. Dis-moi laquelle (ou lesquelles) tu veux que je construise — je peux tout à fait n'en faire qu'une.

## 1. Fil d'actualité de la ligue (« Ce qui s'est passé »)

Aujourd'hui, l'info est éclatée : résultats sur la home, pronostics dans l'Arène, mouvements de startlist ailleurs. Un manager qui revient après 3 jours ne sait pas ce qu'il a manqué.

Proposition : un fil chronologique unique en haut de la home de ligue, avec des cartes courtes et cliquables :
- « Étape 12 du Tour saisie — tu as marqué 340 pts, 3e sur l'étape »
- « Pronostic Vuelta étape 5 : clôture dans 2 h, tu n'as pas joué » (action directe)
- « Ton coureur X est blessé / absent de la startlist de Y »
- « Nouveau message trash talk (3) »
- « Enchères phase 4 : ouverture demain »

Chaque item est personnalisé pour le manager connecté, avec un badge « nouveau » depuis sa dernière visite. Filtre rapide : Tout / Mes coureurs / Pronostics.

Détails techniques : nouvelle vue SQL `v_league_activity_feed` qui unifie résultats de course, pronostics ouverts/clos, blessures, mouvements startlist et messages d'arène, filtrée par ligue et saison ; un hook `useLeagueActivityFeed` paginé ; composant `LeagueActivityFeed` sur `DashboardHome`. Marqueur de lecture stocké côté manager (dernière consultation) pour le badge « nouveau ».

## 2. Fiche manager complète (page profil)

Les stats manager existent mais dispersées entre Classement, Statistiques et Mon équipe. Il manque un endroit où l'on « regarde » un adversaire.

Proposition : une page `/dashboard/manager/:id` accessible en cliquant n'importe quel nom de manager (classements, arène, pronostics) :
- En-tête : avatar, maillot sponsor, rang actuel, points, évolution sur 5 courses
- Effectif par phase avec points par coureur et meilleurs coups (ROI enchères)
- Courbe de progression vs moyenne de la ligue
- Palmarès : maillots, victoires de prestige, meilleures étapes
- Bilan pronostics : taux de réussite, meilleure série
- Bouton « Comparer avec moi » qui renvoie vers le comparateur existant

Détails techniques : réutilisation des hooks existants (`useManagerJerseys`, `useManagerPrestigeWins`, `useRosters`, `usePrestigeStandings`, ROI) ; une nouvelle page desktop/mobile ; rendre cliquables les composants de nom de manager déjà en place (`ManagerNameWithJersey`).

## 3. Centre de pronostics : rappels et clôtures sans friction

Le rappel par notification existe. Le point faible est l'ergonomie du remplissage quand plusieurs pronostics sont ouverts en même temps (grand tour + classique).

Proposition :
- Un bandeau persistant dans l'Arène : « 3 pronostics ouverts — le prochain ferme dans 1 h 20 » avec compte à rebours et saut direct au premier non rempli
- Mode « remplissage rapide » : un seul écran qui enchaîne les pronostics ouverts (suivant / précédent), avec le profil d'étape déjà en place affiché en contexte
- Duplication du pronostic de l'étape précédente en un clic pour les étapes similaires (pré-remplissage modifiable)
- Résumé après clôture : ce que les autres ont joué, et le gain potentiel

Détails techniques : composants dans `src/components/arena` (bandeau + vue séquentielle réutilisant `PronosticRaceCard`), aucune modification du calcul des points ; le pré-remplissage écrit dans la table de pronostics existante via les mutations déjà utilisées.
