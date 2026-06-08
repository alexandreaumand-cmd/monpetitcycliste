## Problème

Les emails d'enchères référencent `https://labordure.app/logo-bordure-light.png`, mais ce fichier n'existe pas dans `public/`. Il se trouve uniquement dans `src/assets/` (bundlé par Vite avec un hash, donc non accessible à cette URL fixe). Résultat : l'image cassée dans Gmail.

## Correction

1. Copier `src/assets/logo-bordure-light.png` vers `public/logo-bordure-light.png` pour qu'il soit servi tel quel à `https://labordure.app/logo-bordure-light.png`.
2. Aucun changement de code dans les templates : l'URL `${SITE_URL}/logo-bordure-light.png` fonctionnera dès le prochain déploiement du site.
3. Pas de redéploiement des edge functions nécessaire (les templates ne changent pas), mais on republie le site pour que `public/` soit servi.

## Vérification

Après publication, ouvrir `https://labordure.app/logo-bordure-light.png` en navigation privée → l'image doit s'afficher. Déclencher un round d'enchères de test ou regarder le prochain email reçu : le logo doit apparaître dans l'en-tête vert.
