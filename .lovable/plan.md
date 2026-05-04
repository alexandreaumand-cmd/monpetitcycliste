## Objectif
Faire repartir la publication en supprimant le ou les vrais bloqueurs de build, puis revalider une mise en ligne.

## Plan
1. Vérifier le pipeline de publication côté frontend
- Contrôler la cause exacte de l’échec de build liée au projet, pas seulement l’échec générique dans l’interface.
- Confirmer qu’on n’est plus sur un problème de dépendances npm résiduel.

2. Corriger les bloqueurs de build probables
- Normaliser les lockfiles Bun pour éviter toute ambiguïté pendant l’installation.
- Corriger le point sensible le plus probable : l’import CDN direct dans `src/main.tsx`, qui peut passer en preview mais échouer en publication.
- Conserver le SDK BWORLDS comme demandé par le projet, sans le supprimer, en le rendant compatible avec la build.

3. Vérifier les autres points de publication déjà suspects
- Recontrôler rapidement la config PWA, les assets référencés et les imports frontend lourds (`exceljs`, `file-saver`, `xlsx`).
- Écarter les faux positifs : le backend géré et les assets PWA semblent déjà sains.

4. Valider le correctif
- Relancer une vérification ciblée des éléments qui cassent la publication.
- Te demander de refaire `Publish -> Update` une fois les blocages levés.

## Détails techniques
- Le backend géré répond normalement, donc ce n’est pas la piste principale.
- Les assets PWA référencés dans `vite.config.ts` existent bien, donc ce n’est probablement pas le point bloquant.
- Il reste un doublon `bun.lock` / `bun.lockb`, qui peut encore perturber la résolution selon le pipeline.
- Surtout, `src/main.tsx` contient un import HTTP direct :

```ts
import { init } from 'https://esm.sh/@bworlds/launchkit@1';
```

Ce type d’import peut être toléré dans certains environnements de preview, mais casser une build Vite de publication. C’est actuellement la piste la plus forte.

## Résultat attendu
La publication ne doit plus échouer sur `Publishing failed`, et tu pourras relancer l’update du site normalement.