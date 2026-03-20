

## Plan : Corriger l'ordre des annonces en direct

### Problème

Le `publish_all` dans `publier-annonce` trie les annonces par `winning_amount DESC` (les plus chères d'abord), alors que le comportement souhaité est **les moins chères d'abord**. Le `published_at` incrémental est ensuite utilisé par le frontend pour l'ordre d'affichage.

- **Publish next** (manuel) : trie `ascending: true` ✅ correct
- **Publish all** (auto-mode) : trie `ascending: false` ❌ inversé

### Côté frontend

Le frontend (`AuctionLiveAnnouncements.tsx`) récupère les annonces triées par `published_at DESC` (les plus récentes en haut), puis les affiche en faisant un `.reverse()` pour que la dernière annoncée soit en haut. C'est correct **à condition que** les `published_at` soient attribués dans le bon ordre (les moins chères publiées en premier).

### Solution

**1 fichier impacté** : `supabase/functions/publier-annonce/index.ts`

Changer la ligne 55 du `publish_all` :
```
.order('winning_amount', { ascending: false })  →  .order('winning_amount', { ascending: true })
```

C'est tout. Le tri `ascending: true` assigne les `published_at` incrémentaux du moins cher au plus cher, ce qui garantit que :
- Le coureur le moins cher est annoncé en premier
- Le plus cher est annoncé en dernier et apparaît en haut de la liste (grâce au `.reverse()` du frontend)

