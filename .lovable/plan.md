

# Diagnostiquer et corriger la clôture automatique en LIVE

## Diagnostic (avant toute correction)

### Etape 1 : Vérifier que `clore-round` est déployé en LIVE
Appeler la fonction via `curl_edge_functions` en LIVE avec les paramètres de la ligue "Test DL" :
- auction_id: `5c909f0c-227e-4a43-b7c6-def6ac220781`
- league_id: `4e4930c7-5cf9-49e6-8633-ff88155c7087`
- auto_mode: true

Si 404 → la fonction n'est pas déployée en LIVE → il suffit de publier le projet.
Si erreur 400/500 → on aura le message exact pour corriger.
Si succès → le round sera clôturé et les annonces créées.

### Etape 2 : Ajouter du logging visible dans l'auto-close
Dans `auction-submit-all-bids/index.ts`, le `catch` ligne 439 avale silencieusement les erreurs. Améliorer le logging pour capturer :
- Le status code de l'appel `functions.invoke('clore-round')`
- Le body de la réponse en cas d'erreur

**Fichier modifié :** `supabase/functions/auction-submit-all-bids/index.ts` (lignes 393-405)

```typescript
const response = await supabase.functions.invoke('clore-round', {
  body: {
    auction_id: auction.id,
    league_id: league_id,
    auto_mode: true,
  }
});

if (response.error) {
  console.error('❌ Error auto-closing round:', JSON.stringify(response.error));
  console.error('❌ Response data:', JSON.stringify(response.data));
} else {
  console.log('✅ Round automatically closed:', JSON.stringify(response.data));
}
```

### Etape 3 (si nécessaire) : Ajouter les fonctions manquantes au config.toml
Si le diagnostic confirme un problème JWT, ajouter `clore-round`, `auction-submit-all-bids`, et `publier-annonce` au `config.toml` avec `verify_jwt = false`.

## Impact
- Aucun changement de schema
- Correction ciblée sur le logging et potentiellement le config
- Le round bloqué en LIVE sera traité manuellement lors du diagnostic

