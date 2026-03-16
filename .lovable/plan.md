

## Problème

L'écran que tu vois en premier (casquette centrée, pas de citation, pas de spinner) est le **splash screen natif Android**. Il est généré automatiquement par le système à partir des icônes PWA (`pwa-512x512-v2.png`). Ce n'est PAS contrôlé par le HTML — c'est l'OS qui l'affiche avant même que le navigateur ne charge la page.

Ensuite, le HTML splash (avec citation + spinner) apparaît → d'où les 2 écrans.

## Solution

On ne peut pas supprimer le splash natif Android, mais on peut le rendre **visuellement identique** au splash HTML pour que la transition soit invisible :

1. **Régénérer `public/pwa-512x512-v2.png`** : au lieu de juste la casquette sur fond beige, inclure aussi le spinner et la citation dans l'icône n'est pas possible (c'est une image statique). Mais on peut s'assurer que le splash natif est aussi proche que possible du HTML splash en utilisant le **même logo** que celui affiché dans le HTML splash.

2. **Remplacer `public/splash-logo.png`** par le logo uploadé (`Logo_carré_500x500.png`) — c'est le logo que le HTML splash utilise. Actuellement le fichier `splash-logo.png` semble être un fichier vide/corrompu (le diff montre `<binary>` mais de très petite taille).

3. **Vérifier que `index.html`** référence bien `/splash-logo.png` dans le splash inline.

4. **Séparer les icônes PWA `maskable` et `any`** : actuellement la même icône est utilisée pour `any maskable`, ce qui peut causer des problèmes de rendu. Créer deux entrées distinctes.

### Fichiers modifiés

| Fichier | Modification |
|---|---|
| `public/splash-logo.png` | Remplacer par le vrai logo 500x500 (actuellement corrompu) |
| `src/assets/logo-carre-sans-marque.png` | Remplacer par le même logo |
| `vite.config.ts` | Séparer les icônes `any` et `maskable` |

Le splash natif Android restera toujours visible ~0.5s (c'est le comportement système), mais avec le même logo + même fond beige, la transition sera imperceptible.

