

# Auto-remplissage des porteurs de maillots via Import PCS

## Idee

Quand tu cliques "Importer PCS" pour une etape, en plus d'importer le Top 10 de l'etape, le systeme ira chercher automatiquement les classements General, Points, Montagne et Jeune sur PCS. Le coureur en position 1 de chaque classement = le porteur du maillot correspondant.

## Fonctionnement

1. L'import PCS de l'etape se fait normalement (top 10)
2. Ensuite, 4 appels supplementaires sont faits en parallele vers PCS :
   - General (GC) -> position 1 = Maillot Jaune
   - Points -> position 1 = Maillot Vert
   - Montagne (KOM) -> position 1 = Maillot a Pois
   - Jeune (Youth) -> position 1 = Maillot Blanc
3. Les jersey holders sont remplis automatiquement dans le formulaire
4. Le combattif n'est pas disponible sur PCS, il reste manuel

## Condition

Uniquement pour les courses a etapes, onglet "stages" et classement "Etape". Pour les one-day ou les finaux, pas de changement.

## Fichiers modifies

### `src/components/admin/ResultsEntryStudio.desktop.tsx`

Dans `handlePcsImport`, apres l'import principal des resultats d'etape :
- Verifier qu'on est en mode "Etape" (stage race, onglet stages)
- Lancer 4 appels `importFromPcs` en parallele avec `type_classement` = General, Points, Montagne, Jeune (et `etape_numero: null` car ce sont des classements globaux)
- Pour chaque resultat reussi, prendre `results[0].matched_coureur_id` (position 1) et appeler `setJerseyHolders` pour le type correspondant
- Afficher un toast recapitulatif ("3/4 maillots remplis automatiquement")

### `src/components/admin/ResultsEntryStudio.mobile.tsx`

Meme logique dans le `handlePcsImport` mobile.

## Detail technique

```text
handlePcsImport (etape)
  |
  +--> importFromPcs("Etape", etapeNumero)   --> top 10
  |
  +--> En parallele (Promise.allSettled) :
         importFromPcs("General", null)       --> pos 1 = jaune
         importFromPcs("Points", null)        --> pos 1 = vert
         importFromPcs("Montagne", null)      --> pos 1 = pois
         importFromPcs("Jeune", null)         --> pos 1 = blanc
```

Pas de modification de l'edge function `scrape-pcs-results` -- elle supporte deja tous ces types de classement.

## Limites

- Le maillot combattif (pas de page PCS dediee) reste a saisir manuellement
- Si PCS n'a pas encore publie un classement, le maillot correspondant restera vide (pas d'erreur)
- Les maillots sont pre-remplis mais restent editables avant la sauvegarde

