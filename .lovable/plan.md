
# Correction du Problème de Notifications Push Android

## Problème Identifié

L'Edge Function `send-push-notification` utilise le framework Hono avec une route explicite `/send-push-notification`:

```typescript
app.post('/send-push-notification', async (c) => { ... })
```

Cependant, quand Supabase Edge Functions reçoit un appel à `https://.../functions/v1/send-push-notification`, le path transmis à la fonction est `/` (racine), pas `/send-push-notification`. La route Hono ne matche donc **jamais**.

Cela explique pourquoi :
- La fonction répond avec un status 200 (Hono retourne un 404 JSON avec status 200 par défaut)
- Les logs montrent "Found 1 push subscriptions" mais la notification n'arrive pas
- Aucune erreur n'est visible car Hono catch tout

## Solution

Changer la route de `/send-push-notification` vers `/` dans l'Edge Function :

### Fichier à modifier

`supabase/functions/send-push-notification/index.ts`

### Changement

```typescript
// AVANT (ligne 402)
app.post('/send-push-notification', async (c) => {

// APRÈS
app.post('/', async (c) => {
```

## Vérification Supplémentaire

Ajouter un log au début de la fonction pour confirmer que la requête arrive :

```typescript
app.post('/', async (c) => {
  console.log('Received push notification request');
  try {
    // ... reste du code
```

## Test Après Correction

Redéployer la fonction et relancer le test :
```json
{
  "user_ids": ["84e72276-2ec0-4ae1-8bd2-25026aa2fa97"],
  "title": "🚴 Test Push",
  "message": "Notification de test Android",
  "type": "results_added"
}
```

## Résultat Attendu

- La notification devrait apparaître sur Android/Chrome
- Les logs devraient montrer "Received push notification request" suivi des autres logs
