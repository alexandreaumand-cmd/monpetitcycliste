
# Import PCS avec correction de slug a la demande

## Comportement souhaite

1. Clic sur "Importer PCS" -- l'import se lance directement (pas de dialog)
2. Si ca marche -- les resultats remplissent la grille (comme aujourd'hui)
3. Si erreur de slug (PCS retourne 500 ou 0 resultats) -- un Dialog s'ouvre pour corriger le slug manuellement, puis relancer l'import

## Changements

### 1. Hook `usePcsImport.ts`

- Ajouter un parametre optionnel `pcsSlugOverride` a `importFromPcs()`
- Au lieu de throw sur erreur slug/PCS 500, retourner un objet structure avec le type d'erreur pour distinguer "slug invalide" des autres erreurs
- Retourner aussi le `pcs_url` tente pour l'afficher dans le dialog

### 2. Edge Function `scrape-pcs-results/index.ts`

- Accepter `pcs_slug_override` dans le body
- Si fourni, l'utiliser en priorite ET le sauvegarder dans `courses.pcs_slug` pour les prochains imports
- Retourner `slug_used` dans la reponse pour que le frontend sache quel slug a ete utilise

### 3. Composants Desktop et Mobile

- Ajouter un state `pcsSlugDialog` (ouvert/ferme) et `pcsSlugValue` (le slug a corriger)
- Modifier `handlePcsImport` :
  - Appeler `importFromPcs()` normalement
  - Si erreur de type "slug invalide" (PCS 500, ou message contenant "PCS returned"), ouvrir le Dialog avec le slug detecte pre-rempli
  - Sinon, comportement normal
- Ajouter un Dialog avec :
  - Message expliquant que le slug PCS ne correspond pas
  - Champ texte pre-rempli avec le slug detecte
  - Lien "Verifier sur PCS" pointant vers `procyclingstats.com/race/{slug}`
  - Bouton "Reessayer" qui relance l'import avec le slug corrige

### Details techniques

**Hook - nouveau type de retour enrichi :**
```typescript
interface PcsImportResult {
  results: PcsResult[] | null;
  error?: { type: 'slug_error' | 'other'; message: string; slugUsed?: string };
}
```

**Edge Function - nouveau parametre :**
- `pcs_slug_override` : si present, utilise ce slug et le sauvegarde dans `courses.pcs_slug`
- Reponse enrichie avec `slug_used` pour le feedback

**Dialog de correction :**
- Composant inline dans les deux fichiers Studio (desktop + mobile)
- Utilise les composants Dialog, Input et Button existants
- Pre-remplit le slug detecte automatiquement
- Au clic "Reessayer", appelle `importFromPcs` avec le `pcsSlugOverride`
- Si le retry reussit, le slug est sauvegarde automatiquement cote serveur
