

# Fix : Ligues bloquées sur Phase 1 (complétée) + Prévention

## Diagnostic

**Phase 1** (P1) est terminée depuis le 21/03/2026 (`statut: completed`). La **Phase 2** (P2) est actuellement `active` (22/03 → 08/05).

**5 ligues** ont leurs enchères Round 1 pointant vers P1 alors qu'elle est fermée :

| Ligue | Statut ligue | Enchère opens_at | Action |
|---|---|---|---|
| La compétition | active | 10/04 | → P2 |
| Real estate porn | pending | 04/04 | → P2 |
| SuceurDeRoux | pending | 10/04 | → P2 |
| Testets | pending | 11/04 | → P2 |
| Tête dans le guidon | pending | 22/03 (passé) | → P2 |

## Corrections à apporter

### 1. Corriger les données LIVE (5 auctions)
Mettre à jour `phase_id` et `effective_phase_id` des 5 auctions de P1 vers P2 (`8b939cb8-7079-4938-ba00-920603813092`).

Également mettre à jour les `league_scopes` pour retirer P1 du tableau `phases` de ces ligues (puisqu'elles démarrent en P2, il ne faut pas compter les courses de P1).

### 2. Empêcher la sélection de phases terminées (code)
Dans `CreateLeagueDialog.tsx`, le sélecteur de phase de départ affiche les 5 phases en dur (`[0,1,2,3,4]`) sans vérifier leur statut. Il faut :
- Charger les phases depuis la DB avec leur statut
- Filtrer pour n'afficher que les phases `active` ou futures (pas `completed`)
- Pré-sélectionner la phase active comme valeur par défaut

### 3. Validation côté serveur (leagues-create)
Dans `supabase/functions/leagues-create/index.ts`, ajouter une vérification que la phase sélectionnée n'est pas `completed` :
- Charger le `statut` de chaque phase en plus de `id, index_dans_saison`
- Si `startingPhaseIndex` pointe vers une phase `completed`, retourner une erreur 400

### 4. Affichage dashboard (déjà OK)
La carte de ligue affiche déjà correctement "Enchères programmées" avec le countdown vers `opens_at`. Le problème actuel ("Aucune donnée disponible") vient du fait que la phase pointée est `completed` et qu'il n'y a pas encore de données de classement — une fois les auctions basculées en P2, l'affichage sera cohérent.

## Fichiers impactés
- **Données LIVE** : `auctions` (5 lignes), `league_scopes` (5 lignes) — via outil insert/update
- `src/components/leagues/CreateLeagueDialog.tsx` — filtrer les phases terminées
- `supabase/functions/leagues-create/index.ts` — validation serveur

