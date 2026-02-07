

# Ajout d'une notification push au Daily Recap

## Ce qui va changer

Apres l'envoi du message systeme dans le channel #general, une notification push sera envoyee a tous les membres de la ligue avec le texte :

**Titre :** `📊 Récap du jour — [Nom de la ligue]`
**Message :** `Bravo à [NomManager1], manager du jour !`

ou `NomManager1` est le manager ayant marque le plus de points dans la journee (le premier de la liste `entries`).

## Modifications techniques

### Fichier : `supabase/functions/arena-recaps/index.ts`

1. **Modifier la signature de `sendDailyRecap`** pour recevoir `supabaseUrl` et `serviceKey` (necessaires pour appeler l'Edge Function `send-push-notification`), comme c'est deja le cas pour `sendWeeklyRecap`.

2. **Mettre a jour l'appel** dans le handler principal (ligne 59) pour passer ces deux parametres supplementaires.

3. **Ajouter le bloc push notification** apres l'insertion du message systeme (apres la ligne 215), en suivant le meme pattern que le weekly recap :
   - Recuperer tous les `user_id` des membres de la ligue via `league_members`
   - Appeler `send-push-notification` avec :
     - `user_ids` : tous les membres de la ligue
     - `title` : `📊 Récap du jour — [league.name]`
     - `message` : `Bravo à [nom du 1er manager], manager du jour !`
     - `type` : `arena_daily_recap`
     - `metadata` : `{ league_id: league.id }`

### Aucune autre modification necessaire

- Le systeme de push existant (`send-push-notification`) gere deja le filtrage par preferences utilisateur
- Pas de changement de base de donnees
- Pas de changement cote frontend

