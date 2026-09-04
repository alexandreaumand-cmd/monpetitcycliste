# Ajout colonnes Phase/Étape et filtres/tri dans le tableau Bonus Coureur

## Objectif

Dans l’écran Super Admin > Bonus > onglet « Bonus Coureur », enrichir le tableau « Bonus Coureur attribués » avec les colonnes **Phase** (format `P4`) et **Étape**, puis ajouter des filtres et un tri sur les colonnes Coureur, Course et Points (et accessoirement Phase/Étape).

## Décisions confirmées

- **Phase** affichée sous la forme `P{index_dans_saison}` (ex. `P4`).
- **Étape** affichée avec la valeur `etape_numero` déjà présente sur `bonus_points`.
- **Filtres par colonne** (pas de recherche globale unique) : champs sous les en-têtes concernés.
- **Tri** activé sur les colonnes filtrables : Coureur, Course, Points, Phase, Étape.

## Modifications prévues

1. **Enrichissement de la requête `rider-bonuses`** dans `src/components/admin/bonus/RiderBonusTab.tsx` :
   - Sélectionner `etape_numero`.
   - Joindre `phases!bonus_points_phase_id_fkey(index_dans_saison)` pour construire le libellé `P{index}`.
   - Conserver le chargement existant des noms de ligue et des équipes.

2. **Tableau** :
   - Insérer les colonnes **Phase** et **Étape** entre « Ligue » et « Course » (ordre final : Type, Coureur, Équipe, Manager, Ligue, Phase, Étape, Course, Points, Commentaire, Actions).
   - Afficher `P{index}` ou `—` pour Phase ; `Étape {n}` ou `—` pour Étape.

3. **Filtres par colonne** (ligne d’en-tête filtrante sous les intitulés) :
   - **Coureur** : champ texte filtrant sur `bonus.coureur.nom`.
   - **Course** : champ texte filtrant sur le nom de la course (via `coursesMap`).
   - **Points** : deux petits champs `min` / `max` ou un seul champ numérique filtrant par borne.
   - **Phase** : select avec les phases disponibles de la saison (`P1`, `P2`…) + option « Toutes ».
   - **Étape** : select numérique dynamique (`final` + étapes présentes dans les données) ou champ texte.

4. **Tri par colonne** :
   - Boutons dans les en-têtes des colonnes Coureur, Course, Points, Phase, Étape.
   - État local `sortColumn` / `sortDirection` (`asc` | `desc`).
   - Tri par défaut : Points décroissant.

5. **Réinitialisation** :
   - Bouton « Réinitialiser les filtres/tri » au-dessus du tableau.

6. **Responsive** :
   - Conserver le défilement horizontal existant ; les filtres restent utilisables sur mobile via une ligne d’en-tête compacte.

## Fichiers touchés

- `src/components/admin/bonus/RiderBonusTab.tsx`
- Éventuellement `src/i18n/locales/fr/admin.json` et `en/admin.json` si des libellés génériques sont ajoutés.

## Vérification

- Ouvrir Super Admin > Bonus > onglet « Bonus Coureur ».
- Choisir « Toutes les phases » en haut de page : vérifier que les colonnes Phase et Étape s’affichent et différencient bien les lignes.
- Filtrer sur un coureur, une course, une tranche de points : le tableau se réduit correctement.
- Trier par Phase, Étape, Points : l’ordre change comme attendu.
- Vérifier que le bouton de réinitialisation remet le tableau à son état initial.
