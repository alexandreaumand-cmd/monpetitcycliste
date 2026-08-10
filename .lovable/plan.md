# Correction du bonus « First win » dupliqué et mal rattaché à une ligue

## Ce qui se passe réellement (vérifié en base)

Le bonus First Win de Louis Barré (Tour de Pologne, phase 4) a bien créé **2 lignes** en base, mais toutes les deux avec la ligue **Early Adopters**, alors que Louis Barré n'est dans le roster de Matt L que dans **MPC 2026** et **Suceurs_de_Roux** (Matt L a un roster dans les 3 ligues sur cette phase, mais pas ce coureur dans Early Adopters).

Deux causes cumulées :

1. **Côté écran d'admin** : l'attribution lit les rosters du coureur (`manager_id` seulement, sans la ligue), génère une ligne par roster trouvé — donc 2 lignes pour Matt L — mais **n'écrit jamais la ligue** sur le bonus.
2. **Côté base** : un déclencheur remplit alors la ligue automatiquement en prenant *n'importe quel* roster du manager sur la phase (`LIMIT 1`, sans filtre sur le coureur). Les deux lignes ont donc hérité de la même ligue arbitraire : Early Adopters.

Résultat : doublon dans une ligue, et absence de bonus dans les ligues réellement concernées.

## Correctifs prévus

### 1. Écriture explicite de la ligue à l'attribution
Dans l'écran « Bonus Coureur » (et dans le dialogue d'attribution équivalent) :
- lire `manager_id` **et** `league_id` des rosters du coureur pour la phase ;
- créer une ligne de bonus par couple (manager, ligue) en renseignant explicitement la ligue ;
- dédoublonner les couples identiques avant insertion ;
- message de confirmation indiquant le nombre de managers **et** de ligues concernés.

### 2. Déclencheur base corrigé (filet de sécurité)
Le déclencheur qui déduit la ligue cherchera en priorité le roster **contenant le coureur du bonus** ; l'ancien comportement ne reste qu'en dernier recours.

### 3. Garde-fou anti-doublon
Ajout d'un index unique sur (phase, type de bonus, coureur, manager, ligue, course) pour empêcher toute future duplication du même bonus.

### 4. Nettoyage des données existantes
Suppression des doublons de bonus coureur déjà en base (une ligne conservée par manager/ligue), y compris les 2 lignes First Win de Louis Barré. Le bonus sera ensuite ré-attribué proprement depuis l'écran d'admin (ou par une réinsertion ciblée) pour MPC 2026 et Suceurs_de_Roux.

## Détails techniques

- Fichiers front : `src/components/admin/bonus/RiderBonusTab.tsx`, `src/components/admin/bonus/BonusEntryDialog.tsx`.
- Migration base : mise à jour de `bonus_points_set_league_from_roster()`, `DELETE` des doublons, `CREATE UNIQUE INDEX` partiel sur `bonus_points`.
- Aucun impact sur les bonus manager (`manager_bonus_points`), qui portent déjà une ligue explicite.
