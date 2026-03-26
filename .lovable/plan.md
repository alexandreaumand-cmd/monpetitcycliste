

## Masquer le bouton coureur bonusé quand les bonus sont désactivés

### Problème
Le bouton "Choisir coureur bonus" et les fonctionnalités associées (étoile, dialog de sélection, dialog des coureurs bonusés de la ligue) s'affichent dans **toutes** les ligues, y compris celles où `bonuses_enabled = false` comme "Ligue Publique WT sans bonus".

### Solution
Conditionner l'affichage de tous les éléments liés au coureur bonusé sur `bonuses_enabled` de la ligue courante.

### Fichiers impactés

**1. `src/components/team/MyTeam.desktop.tsx`**
- Récupérer `bonuses_enabled` depuis le contexte de la ligue (ou depuis les données de ligue déjà chargées)
- Envelopper dans `bonuses_enabled &&` :
  - Le bouton "Choisir coureur bonus" (~ligne 622)
  - Le bouton "Voir les coureurs bonusés" (~ligne 633)
  - L'étoile à côté du nom du coureur bonusé (~ligne 798)
  - Le dialog de sélection (~ligne 903)
  - Le dialog des coureurs bonusés de la ligue (~ligne 958)
- Sauter la requête `bonus_rider_selections` si `!bonuses_enabled`

**2. `src/components/team/MyTeam.mobile.tsx`** (même logique)
- Mêmes conditions sur les éléments bonus rider mobile

**3. Accès à `bonuses_enabled`**
- Vérifier si le `LeagueContext` expose déjà `bonuses_enabled` ; sinon, l'ajouter depuis la requête ligue existante

### Résultat attendu
- "Ligue Publique WT sans bonus" : aucun bouton bonus, aucune étoile, aucun dialog
- Ligues avec bonus activés : comportement inchangé

