## Objectif
Restaurer les lockfiles `bun.lockb` et `package-lock.json` exactement tels qu'ils existaient dans le dernier publish fonctionnel (commit `57afcaf`, 02/05 ~09:19), pour vérifier si leur absence est ce qui fait échouer le pipeline de publication.

## Contexte
- Snapshot de référence `57afcaf` : contient `bun.lock`, `bun.lockb`, `package-lock.json`, `package.json`.
- État actuel du repo : seul `bun.lock` est présent. `bun.lockb` et `package-lock.json` ont été supprimés lors d'une étape précédente de troubleshooting.
- `package.json` et `bun.lock` ont déjà été ramenés à l'état du 02/05 lors de la précédente itération.
- Hypothèse : le pipeline de publish s'attend à trouver l'un de ces lockfiles binaires/npm — leur disparition coïncide avec le début des échecs.

## Plan
1. **Restaurer les deux fichiers depuis le commit de référence**
   - `git checkout 57afcaf -- bun.lockb`
   - `git checkout 57afcaf -- package-lock.json`
   - Ces fichiers seront restaurés à l'octet près tels qu'ils étaient au dernier publish réussi.

2. **Vérifications de cohérence (lecture seule)**
   - Confirmer que `bun.lock`, `bun.lockb`, `package-lock.json` et `package.json` correspondent tous au snapshot `57afcaf` (comparaison via `git diff 57afcaf -- <fichier>`).
   - S'assurer qu'aucun autre fichier de build (`vite.config.ts`, `tsconfig*.json`, `index.html`, `src/main.tsx`) n'a divergé depuis.

3. **Ne rien toucher d'autre**
   - Aucune modification de `package.json`, du code applicatif, des migrations SQL, des paramètres de visibilité, du domaine ou du badge.
   - Les fonctionnalités ajoutées depuis le 02/05 (ligues publiques, etc.) restent intactes.

4. **Demander un nouvel essai de publication**
   - Une fois les lockfiles restaurés, tu relances `Publish → Update`.
   - Si ça passe : la suppression des lockfiles était la cause racine.
   - Si ça échoue encore : on enchaîne sur la piste suivante (vérifier les migrations SQL du 04/05, ou demander le log d'erreur exact du publish).

## Détails techniques
- Commit de référence : `57afcaf58b1615a90daa2da7026c68a8b571dde9` (02/05 07:19 UTC ≈ 09:19 Paris).
- Hashes attendus après restauration :
  - `bun.lockb` → `d3914e8476ac7bcf7821f221922c3af9816eb903`
  - `package-lock.json` → `5184d75bfdc3efe7443681b4c32dd3e6addeb2d5`
- Aucun `bun install` / `npm install` ne sera exécuté : on veut le contenu exact du dernier publish, pas un lockfile régénéré qui pourrait à nouveau diverger.

## Résultat attendu
Le repo retrouve les trois lockfiles tels qu'ils étaient au dernier publish réussi. Tu peux relancer `Publish → Update` et on saura si l'absence de ces fichiers était bien la cause de la panne.