# Événements du livetext PCS dans la Timeline

## Ce qui est vérifié

La page live de PCS (ex. Vuelta étape 5) contient bien un fil « livetext » exploitable : chaque événement est un bloc avec le km restant, le texte, le lien du coureur et l'heure. Les 6 situations demandées y figurent avec des formulations stables :

- `X (Équipe) pulling in peloton` (attention : parfois c'est une **équipe** qui « pulling », pas un coureur)
- `X (Équipe) in position 2.`
- `X (Équipe) is at the back of the peloton.`
- `Crash by X (Équipe) in peloton`
- `X (Équipe) at the team car.`
- `X (Équipe) abandoned the race`

Aujourd'hui le parseur PCS live ne récupère que la « Situation » (groupes) et renvoie une liste d'événements **vide** : la Timeline ne contient donc que la recopie de la situation toutes les 30 min. C'est cette partie qui est à compléter.

Le nom du manager est déjà géré automatiquement : quand un message contient des « mentions de coureurs » (coureur_id), l'affichage ajoute le manager propriétaire à côté du nom. Il suffit donc de rattacher chaque événement au coureur identifié.

## Ce que je vais faire

1. **Lire le livetext PCS** : extraire chaque événement (km restant, horodatage, texte, coureur lié) et le classer dans l'une des 6 catégories : Relais (pulling), Position, Queue de peloton, Chute, Voiture d'équipe, Abandon. Les autres commentaires sont ignorés, ainsi que les « pulling » d'équipes sans coureur.
2. **Rattacher le coureur au manager** : le coureur du lien PCS est apparié à la startlist de la course pour obtenir son identifiant, puis son manager de la phase en cours.
3. **Publier dans la Timeline** : à chaque passage du scraping automatique, les nouveaux événements (jamais publiés) sont ajoutés à la Timeline de l'Arène, du plus ancien au plus récent, avec une icône/étiquette par type et le texte en français, par exemple :
   - `🔧 Mads PEDERSEN (Ludo) fait le relais dans le peloton`
   - `2️⃣ Tadej POGAČAR (Fab) est en position 2`
   - `⬇️ Ethan HAYTER (—) est en queue de peloton`
   - `⚠️ Chute de Xabier Mikel AZPARREN (Ludo) dans le peloton`
   - `🚗 Koen BOUWMAN (Snoop) est à la voiture d'équipe`
   - `❌ Roel VAN SINTMAARTENSDIJK (—) abandonne`
   Le nom du manager s'affiche entre parenthèses lorsque le coureur appartient à un roster de la ligue ; sinon `(-)`, comme dans la colonne Situation.
4. **Anti-doublons** : chaque événement PCS possède un identifiant unique ; il ne sera publié qu'une seule fois, même si le scraping repasse toutes les X minutes. La recopie de la situation toutes les 30 min reste inchangée.

## Détails techniques

- `supabase/functions/scrape-live-race/index.ts` : dans `parsePCSLive`, parcourir `li.event` (`div.bol` = km to go, `div.textCont` = texte, `a[href*='rider/']` = coureur, `div.timeago2[data-ts]` = timestamp, `data-uid` = clé de dédoublonnage). Classification par expressions régulières sur les 6 formulations ; renvoi dans `events` avec `{ uid, type, kmToGo, ts, riderName, riderSlug, team, text }`. Ces événements passent ensuite par `nameToIdMap` pour obtenir `coureur_id` + manager, et sont retournés dans la réponse (`timeline`).
- `supabase/functions/live-broadcast-auto-scrape/index.ts` : après le scrape, insérer dans `arena_messages` (type `admin_broadcast`, un message par canal live des ligues actives) les événements dont l'`uid` n'apparaît pas déjà dans `metadata.live_event_uid` des messages récents de la course. Metadata : `{ live_event_uid, live_event_type, etape_numero, rider_mentions: [{ rider_nom, coureur_id }] }` pour que `MessageBubble` ajoute le manager. Limiter à ~10 nouveaux événements par exécution pour éviter les rafales.
- Aucune modification de schéma nécessaire.
