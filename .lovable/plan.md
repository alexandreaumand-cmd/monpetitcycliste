## Objectif
Revenir au dernier état de publication connu comme sain, sans toucher aux réglages de visibilité du site ni aux fonctionnalités métier récentes.

## Ce que j’ai déjà vérifié
- Les réglages de publication n’ont pas été modifiés côté visibilité : le site est toujours **published + public**.
- Le badge publicitaire est simplement **masqué** ; ce réglage n’empêche pas une publication.
- Depuis l’état du **02/05 vers 09:20**, les seuls fichiers liés à la publication qui ont changé sont :
  - `src/main.tsx`
  - `package.json`
  - `bun.lock`
  - `bun.lockb` (supprimé)
  - `package-lock.json` (supprimé)
- Il n’y a pas d’indice qu’un “paramètre de publish” ait été changé ; le problème ressemble plutôt à un **changement d’entrées de build**.

## Plan
1. Restaurer les fichiers de build au dernier état de référence
- Revenir au contenu de `src/main.tsx` tel qu’il était avant l’erreur, avec l’import CDN BWORLDS conservé.
- Retirer l’ajout npm `@bworlds/launchkit` de `package.json` et réaligner `bun.lock` sur l’état de référence.
- Restaurer les lockfiles supprimés uniquement si l’état de référence les utilisait.

2. Conserver les réglages de publication inchangés
- Ne toucher ni à la visibilité publique, ni au domaine, ni au badge tant qu’aucun signal ne montre qu’ils sont en cause.

3. Valider le retour à un état publiable
- Vérifier que les fichiers sensibles au build correspondent bien au snapshot du 2/05.
- Te faire relancer `Publish → Update` après ce rollback ciblé.

## Détails techniques
- Commit de référence juste avant 09:20 locale : `57afcaf58b1615a90daa2da7026c68a8b571dde9`.
- Les changements les plus suspects sont ceux du **04/05 à 08:33 UTC** :
  - remplacement de l’import CDN BWORLDS par un import npm dans `src/main.tsx`
  - ajout de `@bworlds/launchkit` dans `package.json` / `bun.lock`
  - suppression de `bun.lockb`
- En revanche, je n’ai trouvé **aucune modification de paramètres de publication** expliquant directement l’échec.

## Résultat attendu
La prochaine tentative de publication repartira du même socle de build que le dernier publish fonctionnel, ce qui permettra de confirmer si la panne vient bien des changements récents sur les fichiers de build.