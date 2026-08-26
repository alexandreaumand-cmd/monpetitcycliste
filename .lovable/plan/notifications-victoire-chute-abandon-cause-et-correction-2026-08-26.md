# Notifications « victoire / chute / abandon » : cause et correction

## Ce qui s'est passé

Vérification faite en base :

- L'évènement victoire a bien été détecté et publié dans la timeline : message `🥇 {BRENNAN Matthew} s'impose !` diffusé le 26/08 à 15:25 dans les 7 ligues, dont MPC 2026.
- Manou possède bien Matthew Brennan dans MPC 2026 sur la phase en cours (prix 209 M).
- **Aucune notification `rider_win` ni `rider_incident` n'existe en base** — pas une seule depuis la mise en place. Les seuls types présents sont `results_added`, `startlist_validated`, `auction_opened/closed/validation`.

Cause confirmée : la table `notifications` porte une contrainte `notifications_type_check` qui n'autorise que les six anciens types. Les types `rider_win` et `rider_incident` sont donc refusés par la base. Comme l'insertion se fait en un seul lot, **toutes** les notifications du lot échouent — d'où zéro notification pour les chutes, abandons et victoires depuis le début.

## Correction

1. Migration base de données : remplacer `notifications_type_check` par une version incluant `rider_incident`, `rider_win` et `pronostic_reminder` (ce dernier étant également absent de la liste autorisée).
2. `supabase/functions/live-broadcast-auto-scrape/index.ts` : rendre l'insertion résiliente — en cas d'échec du lot, réessayer notification par notification et journaliser précisément le type fautif, afin qu'un futur type inconnu n'annule plus tout le lot.
3. Redéploiement de la fonction et vérification sur le prochain évènement live (contrôle des logs + lecture de la table `notifications`).

Aucune notification rétroactive ne sera créée pour la victoire de Brennan (l'évènement est passé) ; les prochains évènements seront bien notifiés.
