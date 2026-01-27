
# Correction de l'erreur 404 sur send-push-notification

## Problème Identifié

Les logs Analytics montrent clairement :
- OPTIONS → 200 (preflight CORS OK)
- POST → 404 (route non trouvée)

Le middleware Hono actuel a deux problèmes :
1. Il modifie `c.res.headers` après `await next()`, ce qui ne fonctionne pas correctement en Hono car la réponse est déjà construite
2. La structure du middleware peut empêcher Hono de router correctement vers `app.post('/')`

## Solution Proposée

Simplifier le code en utilisant le pattern `Deno.serve()` natif (comme toutes les autres Edge Functions du projet) au lieu de Hono. Cela garantit la compatibilité et simplifie le debugging.

### Changements dans `supabase/functions/send-push-notification/index.ts`

Réécrire la fonction pour utiliser `Deno.serve()` directement :

```text
Structure simplifiée :
1. Import des dépendances (sans Hono)
2. CORS headers constants
3. Fonctions utilitaires (inchangées)
4. Deno.serve() avec:
   - Gestion OPTIONS → retour CORS
   - Gestion POST → logique existante
   - Inclusion des corsHeaders dans TOUTES les réponses
```

### Points Clés de la Réécriture

1. **Supprimer Hono** - Utiliser `Deno.serve(async (req) => {...})`

2. **CORS systématique** - Inclure les headers dans chaque `return new Response(...)`

3. **Conserver toute la logique métier** :
   - Validation VAPID
   - Récupération des subscriptions
   - Filtrage par préférences
   - Envoi Web Push avec encryption aes128gcm
   - Nettoyage des subscriptions expirées

4. **Structure des réponses JSON** :
   ```typescript
   // Erreur
   return new Response(JSON.stringify({ error: '...', code: '...' }), { 
     status: 500, 
     headers: { ...corsHeaders, 'Content-Type': 'application/json' }
   });
   
   // Succès
   return new Response(JSON.stringify({ sent: X, failed: Y }), {
     status: 200,
     headers: { ...corsHeaders, 'Content-Type': 'application/json' }
   });
   ```

## Fichiers Modifiés

- `supabase/functions/send-push-notification/index.ts` : Réécriture sans Hono

## Validation

Après déploiement :
1. Test via curl direct vers l'edge function
2. Test via le bouton "Envoyer une notification test" dans la PWA
3. Vérification que le status passe de 404 à 200
4. Vérification de la réception de la notification sur Android
