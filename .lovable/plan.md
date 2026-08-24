# Alléger et améliorer l'Arène

## Constat d'usage (données réelles de la base)

| Fonctionnalité | Volume |
| --- | --- |
| Messages (Trash Talk) | 25 299 |
| Pronostics | 2 173 |
| Réactions aux messages | 23 |
| Sondages créés | 1 (5 votes) |
| Points de prestige (Hall of Fame) | 13 |

Conclusion : deux onglets portent tout l'usage (Pronostics, Trash Talk). Les onglets **Votes** et **Hall of Fame** occupent 50 % de la barre de navigation pour un usage quasi nul, ce qui alourdit l'écran sur mobile (4 onglets, libellés masqués sous 640 px : on ne voit que des icônes).

## Proposition

### 1. Passer de 4 onglets à 2

- Barre d'onglets réduite à **Pronostics** et **Trash Talk**, libellés visibles aussi sur mobile (plus d'onglets « icône seule » indéchiffrables).
- **Hall of Fame** n'est plus un onglet : le podium prestige est intégré en encart compact dans le classement des pronostics (là où l'utilisateur regarde déjà les classements), replié par défaut s'il n'y a pas assez de données.
- **Votes** n'est plus un onglet permanent : un sondage ouvert apparaît en bandeau/carte en tête du Trash Talk (là où sont les managers), et le bouton « créer un sondage » reste accessible aux admins de ligue depuis ce même endroit. Les anciens sondages restent consultables via un lien « sondages passés ».
- Les URLs existantes `?tab=votes` et `?tab=halloffame` redirigent vers le nouvel emplacement (pas de lien cassé).

### 2. Rendre l'écran plus agréable — desktop

- Mise en page en deux colonnes sur l'onglet Pronostics : à gauche les courses (à venir / en cours / passés), à droite une colonne « sidebar » collante avec le classement pronostics + le podium prestige. Fin du scroll unique très long.
- Trash Talk : hauteur de conversation calée sur la hauteur de fenêtre, en-tête compact, champ de saisie fixe en bas.
- En-tête d'Arène unifié : un seul bandeau discret avec le nom de la ligue, la prochaine échéance de pronostic et le nombre de messages non lus, au lieu des bannières empilées actuelles.

### 3. Rendre l'écran plus agréable — mobile

- Onglets pleine largeur avec texte + icône, en position collante en haut.
- Cartes de course pronostic condensées (même logique que les cartes de ligue déjà condensées sur la home) : titre, échéance en relief, statut du pronostic, et détails au dépli.
- Classement pronostics accessible via un bouton dédié en haut de l'onglet, pas via un long scroll.
- Trash Talk : espace vertical maximisé (moins de marges), saisie ancrée au clavier.

### 4. Nettoyage technique

- Suppression des rendus morts et des libellés d'onglets inutilisés ; `VotesTab` / `HallOfFameSection` sont réutilisés dans leur nouvel emplacement (pas de code dupliqué), `CreatePollDialog` conservé.
- Aucune suppression de données ni de table : les sondages, réactions et points de prestige restent en base et restent visibles.

## Détails techniques

- `src/pages/ArenaPage.tsx` : réduction à 2 onglets, redirection des anciens paramètres `tab`, nouveau layout desktop en grille (`lg:grid-cols-[1fr_320px]`).
- `src/components/arena/PronosticsTab.tsx` : passage en layout 2 colonnes desktop, sidebar collante contenant `PronosticStandings` + `HallOfFameSection` (variante compacte), version mobile condensée.
- `src/components/arena/HallOfFameSection.tsx` : ajout d'une prop `variant="compact"` (podium sur une ligne, sans Card imbriquée).
- `src/components/arena/TrashTalkTab.tsx` : intégration en tête d'un bloc sondage (réutilise `PollCard` + `CreatePollDialog` pour les admins) et calage de la hauteur sur la fenêtre.
- `src/components/arena/PronosticRaceCard.tsx` : densification mobile (padding, tailles de texte), pas de changement de logique métier.
- Traductions : ajustement des clés `arena.tabs.*` dans `fr` et `en`, ajout des libellés « sondages passés » / « prestige ».
