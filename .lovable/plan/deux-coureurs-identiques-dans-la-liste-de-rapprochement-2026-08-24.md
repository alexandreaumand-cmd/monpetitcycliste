# Deux coureurs identiques dans la liste de rapprochement

## Ce qui se passe

Ce ne sont pas deux fois le même coureur : ce sont bien **deux fiches distinctes** en base avec exactement le même nom. Pour « Edison Alejandro CALLEJAS » :

- `CAL991` — rattaché à la saison **2026**
- `edison_alejandro_callejas` (ancien identifiant historique) — rattaché à la saison **2024**

Le bouton de suggestion n'affiche que le nom, donc les deux fiches paraissent identiques et rien ne permet de choisir la bonne. Ce cas n'est pas isolé : **90 noms** sont présents en double dans la table des coureurs (héritage des anciens identifiants « slug » avant la bascule vers les codes courts).

## Ce que je propose de faire

1. **Rendre les suggestions différenciables**
   Chaque proposition affichera, en plus du nom : l'identifiant, la dernière saison connue et l'équipe de cette saison. Exemple :
   `Edison Alejandro CALLEJAS · CAL991 · 2026 · Roojai Insurance Winspace`

2. **Trier intelligemment**
   Les fiches avec une saison récente et active remontent en premier ; les fiches sans saison récente sont marquées « fiche ancienne » et placées en bas.

3. **Éviter les doublons visuels inutiles**
   Si une seule des fiches a un rattachement à la saison cible du transfert, elle est proposée en premier avec un marqueur « recommandée ».

4. **Affichage du coureur retenu**
   Actuellement, une fois le coureur choisi, l'écran affiche l'identifiant brut (`CAL991`). Il affichera le nom du coureur suivi de son identifiant.

Aucune fusion ni suppression de fiches en base n'est faite dans ce lot : c'est un chantier séparé (nettoyage des 90 doublons) que je peux proposer ensuite si vous le souhaitez.

## Détails techniques

- Fichier : `src/components/admin/TransfersManager.tsx`
- La requête de recherche passe de `coureurs(id, nom)` à une requête enrichie joignant `coureurs_saisons` (dernière saison, `actif`, `equipe_id`) et `equipes_saisons` (`nom_affiche`), triée par année décroissante.
- Le rendu des boutons de suggestion inclut nom + id + saison + équipe, avec badge « recommandée » quand `saison_id` correspond à `target_year`.
- Le badge du coureur retenu résout le nom via la même donnée au lieu d'afficher `coureur_id`.
