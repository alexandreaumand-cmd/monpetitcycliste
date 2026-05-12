## Constats

- **Pas d’écart significatif entre TEST et LIVE** : les deux environnements backend sont joignables, sains, et ont le **même état de migration enregistré**.
- **Version de migration atteinte dans TEST et LIVE** : `20260503153746`
- **Historique du dépôt** : `524` fichiers de migration
- **Historique réellement enregistré dans la base** : `498` versions
- **Écart réel dépôt ↔ backend** : **193 migrations du dépôt ne sont pas enregistrées** dans TEST **ni** LIVE.
- Cet écart commence très tôt (`20251002171214`) et va jusqu’à la dernière migration locale (`20260512075958`).
- Plusieurs objets de ces migrations “manquantes” **existent déjà quand même** dans la base, ce qui montre une **dérive d’historique** : le schéma réel et le dossier `supabase/migrations` ne racontent plus la même histoire.
- Les signaux “poids du projet” ne sont **pas** le suspect principal :
  - Edge functions : `114 / 130`
  - Assets : `4.44 MB / 8 MB`
  - Migrations : `523 / 600` (beaucoup, mais pas suffisant seul pour expliquer l’échec)
- Pas d’erreurs PostgreSQL récentes visibles dans les logs consultés.

## Diagnostic probable

La cause la plus probable du **"Publishing failed"** n’est **pas** une différence TEST vs LIVE, mais une **désynchronisation entre le dépôt et l’état réel du backend**.

En pratique, au moment de publier, la plateforme essaie très probablement de réconcilier/appliquer un historique de migrations qui :
- contient des fichiers non enregistrés côté backend,
- alors que les objets correspondants existent déjà parfois,
- ce qui peut produire des collisions du type :
  - objet déjà existant,
  - policy déjà existante,
  - contrainte déjà existante,
  - vue/fonction déjà créée sous une autre version,
  - historique de migrations devenu non linéaire.

## Pourquoi c’est le meilleur suspect

- TEST et LIVE sont **alignés entre eux** → ce n’est pas un problème de “Live différent de Test”.
- Le backend est **disponible** → ce n’est pas un backend en panne.
- Le dépôt contient **beaucoup de migrations absentes du registre de migrations**, y compris des migrations anciennes.
- Certaines de ces migrations absentes ont déjà leurs effets visibles dans la base → signe classique d’un **historique local cassé, dupliqué, importé, réécrit ou partiellement appliqué hors registre**.

## Pistes de correction recommandées

### Option recommandée : refaire une base propre de migrations
C’est la voie la plus sûre si le backend actuel est la source de vérité.

1. **Geler temporairement les nouvelles migrations** tant que l’historique n’est pas réconcilié.
2. **Auditer les 193 migrations manquantes** pour les classer :
   - déjà reflétées dans la base,
   - réellement absentes,
   - potentiellement conflictuelles.
3. **Choisir une source de vérité** :
   - soit le backend actuel,
   - soit le dossier de migrations du dépôt.
4. Si **le backend actuel est correct**, alors :
   - archiver l’historique de migrations devenu incohérent,
   - recréer un **baseline propre** à partir du schéma réel actuel,
   - puis repartir avec de nouvelles migrations linéaires.
5. Revalider ensuite un publish sur une base de migrations cohérente.

### Option alternative : rendre les migrations manquantes rejouables
Possible, mais plus risqué avec 193 écarts.

1. Reprendre les migrations manquantes par ordre chronologique.
2. Les rendre **idempotentes** quand c’est possible (`IF NOT EXISTS`, garde-fous, `DROP ... IF EXISTS`, checks sur policies/contraintes/fonctions).
3. Tester leur exécution en lot dans TEST.
4. Corriger chaque collision jusqu’à obtenir un historique rejouable.

Cette option est plus longue et fragile si l’historique a beaucoup dérivé.

## Corrections ciblées à préparer

- Vérifier chaque migration manquante qui crée/modifie :
  - tables,
  - policies RLS,
  - fonctions `SECURITY DEFINER`,
  - vues / materialized views,
  - contraintes uniques,
  - triggers.
- Éliminer les migrations “fantômes” dont les objets existent déjà sous une autre version.
- Fusionner ou remplacer les migrations historiques qui ont été dupliquées ou réécrites.
- Réduire le risque de futur blocage avec un **baseline unique** au lieu de continuer à empiler sur un historique incohérent.

## Points secondaires observés

- Le linter remonte encore beaucoup de sujets sécurité/DB, mais ce n’est pas le meilleur indicateur du blocage de publish actuel.
- Le snapshot de prépublication montre un projet assez chargé en migrations, ce qui **augmente la fragilité**, sans être la cause racine la plus probable.

## Plan d’action concret

1. Générer un **rapport de dérive complet** entre le dossier `supabase/migrations` et l’état réel de TEST.
2. Identifier les migrations manquantes dont les objets existent déjà.
3. Décider si on :
   - **reconstruit un baseline propre** (recommandé), ou
   - **répare l’historique existant**.
4. Préparer la correction choisie sans toucher à LIVE tant que TEST n’est pas propre.
5. Vérifier qu’un publish passe à nouveau.

## Détails techniques

```text
TEST backend: sain
LIVE backend: sain
TEST migration head: 20260503153746
LIVE migration head: 20260503153746
Repo migrations: 524
DB migrations enregistrées: 498
Migrations du repo absentes des deux environnements: 193
Conclusion: dérive dépôt ↔ backend, pas dérive TEST ↔ LIVE
```

Si tu veux, l’étape suivante la plus utile est que j’**établisse le rapport de dérive exploitable et prépare une stratégie de baseline propre**, pour remettre les publications en état sans casser le backend existant.