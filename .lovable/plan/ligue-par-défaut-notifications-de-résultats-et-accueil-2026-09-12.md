# Ligue par défaut : notifications de résultats et accueil

## À quoi sert la « ligue par défaut » aujourd'hui

Elle sert uniquement au démarrage : quand tu ouvres l'application sans lien précisant une ligue, c'est cette ligue qui est sélectionnée. Si le lien contient déjà une ligue (cas des notifications), c'est ce lien qui gagne.

C'est ce qui explique ton constat : chaque notification de résultat embarque une ligue, et pour un manager membre de plusieurs ligues, la ligue retenue est choisie au hasard (la première par identifiant), pas ta ligue par défaut. Vérifié : une seule notification est déjà envoyée par manager et par course/étape, mais avec cette ligue arbitraire.

## Correction 1 — la notification ouvre la ligue par défaut

Modifier la règle qui crée les notifications de résultats pour que la ligue attachée à la notification soit, en priorité, la ligue par défaut du manager (si cette ligue est concernée par la course). Sinon, comportement actuel inchangé.

Résultat : le clic sur une notification de résultat ouvre la page Résultats dans ta ligue par défaut, avec la course déjà ouverte.

## Correction 2 — ligue par défaut en tête de l'accueil

Sur l'accueil, afficher la carte de la ligue par défaut en première position parmi les ligues en cours. L'ordre des autres ligues reste inchangé. Aucun badge ajouté.

## Détails techniques

- Migration : `notify_results_added` — jointure sur `managers.preferred_league_id` et `ORDER BY m.id, (ls.league_id = m.preferred_league_id) DESC NULLS LAST, ls.league_id` pour que le `DISTINCT ON (m.id)` retienne la ligue préférée quand elle fait partie des ligues concernées.
- `src/pages/DashboardHome.tsx` : trier `activeLeagues` en plaçant `preferred_league_id` en premier. La valeur est récupérée via le profil manager déjà chargé (`manager.preferred_league_id`).
- Aucune modification du routage des notifications côté client : `NotificationCenter` utilise déjà `metadata.league_id`.
- Les notifications déjà existantes gardent leur ancienne ligue ; l'effet est visible sur les prochains résultats.
