

## Correction : Filtrage temporel des annonces dans `auction-get-live-status`

### Problème
La fonction `publier-annonce` met `published = true` sur toutes les annonces instantanément, mais échelonne les `published_at` toutes les 10s. Le endpoint `auction-get-live-status` filtre uniquement sur `published = true`, donc tout apparaît d'un coup.

### Correction

**Fichier** : `supabase/functions/auction-get-live-status/index.ts`

Ajouter `.lte('published_at', new Date().toISOString())` à la requête des annonces (ligne ~74), après le filtre `.eq('auction_id', auction_id)`.

Avant :
```typescript
.eq('auction_id', auction_id)
.order('published_at', ...)
```

Après :
```typescript
.eq('auction_id', auction_id)
.lte('published_at', new Date().toISOString())
.order('published_at', ...)
```

Le frontend poll toutes les 3s → chaque annonce apparaîtra naturellement quand son `published_at` sera atteint, soit toutes les ~10 secondes.

