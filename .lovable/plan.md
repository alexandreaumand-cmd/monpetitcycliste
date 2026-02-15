

## Probleme identifie

La fonction `arena-evaluate-pronostics` contient un mapping incorrect pour les courses d'un jour :

```
one_day_winner -> type_classement = 'Etape'  (FAUX)
```

Or les resultats des courses d'un jour sont enregistres avec `type_classement = 'General'`. La fonction cherche donc un vainqueur dans un classement qui n'existe pas et renvoie une erreur 404.

## Correction

### 1. Corriger le mapping dans `arena-evaluate-pronostics`

Fichier : `supabase/functions/arena-evaluate-pronostics/index.ts`

Remplacer le mapping actuel (lignes 65-77) par une logique qui tente d'abord `General`, puis `Etape` pour `one_day_winner` :

```typescript
let type_classement: string;
if (pronostic_type === 'stage_winner') {
  type_classement = 'Etape';
} else if (pronostic_type === 'gc_winner') {
  type_classement = 'General';
} else if (pronostic_type === 'one_day_winner') {
  // One-day races store results as 'General', but fallback to 'Etape'
  type_classement = 'General';
} else {
  // error
}
```

Avec un fallback : si aucun vainqueur n'est trouve avec `General`, retenter avec `Etape` (pour les cas ou des resultats seraient stockes differemment).

### 2. Deployer la fonction

La fonction sera deployee automatiquement apres modification.

### 3. Evaluer les pronostics Clasica de Almeria en production

Apres le deploiement, le bouton "Evaluer" fonctionnera. Alternativement, l'evaluation a deja ete integree automatiquement dans `admin-result-save-lot` (qui utilise le bon mapping `General -> one_day_winner` depuis la derniere correction). Ce fix corrige uniquement le bouton manuel d'evaluation.

