

## Plan : Automatisation complète du cycle d'enchères

### Constat actuel

Le code contient déjà **une ébauche d'automatisation** dans `auction-submit-all-bids` (lignes 317-405) : quand un manager valide ses enchères, il vérifie si tous les rosters sont complets et appelle `clore-round` automatiquement. Cependant, cette logique vérifie les **rosters complets** (tous les managers ont max_riders), pas simplement si **tous les managers éligibles ont validé leurs enchères** (statut `pending`).

Le flux actuel admin est :
1. Admin ouvre un round → `ouvrir-nouveau-round`
2. Managers placent et valident leurs enchères → `auction-submit-all-bids`
3. Admin ferme le round → `clore-round` (résout les enchères, crée les annonces)
4. Admin publie les annonces une par une ou en bloc → `publier-annonce`
5. Quand toutes les annonces sont publiées, `publier-annonce` lance automatiquement le round suivant (+48h)

### Ce qu'il faut changer

**Objectif** : quand le dernier manager éligible valide ses enchères, tout s'enchaîne automatiquement sans intervention admin.

---

### Étape 1 — Corriger la détection "tous les managers ont validé" dans `auction-submit-all-bids`

Actuellement le code vérifie si tous les rosters sont **complets** (count >= max_riders). Il faut plutôt vérifier si **tous les managers éligibles ont des bids en statut `pending`** pour cette auction/league. C'est la même logique que `auction-get-validation-status` : comparer les managers éligibles (slots restants > 0) avec ceux qui ont des bids `pending`.

Modification : remplacer la logique de vérification (lignes ~317-405) par un check basé sur `validated_count === total_eligible_managers`.

---

### Étape 2 — Automatiser la publication des annonces après fermeture

Actuellement, après `clore-round`, l'admin doit manuellement appeler `publier-annonce`. Il faut qu'après la fermeture automatique du round, les annonces soient publiées automatiquement avec un délai de **10 secondes entre chaque annonce**.

Deux approches possibles :

**Approche retenue : Publication progressive côté client (realtime)**
- Après `clore-round`, les annonces sont créées en DB (déjà le cas) mais restent `published = false`
- Une nouvelle edge function `auto-publish-annonces` est appelée automatiquement après `clore-round`
- Cette fonction publie toutes les annonces d'un coup avec des timestamps espacés de 10 secondes (`published_at` incrémental)
- Le frontend utilise déjà le realtime et les timestamps pour afficher les annonces progressivement — on adapte `AuctionLiveAnnouncements` pour révéler les annonces selon leur `published_at` (timer côté client)

---

### Étape 3 — Adapter le deadline du nouveau round à 24h (au lieu de 48h)

Dans `publier-annonce`, le nouveau round est déjà lancé automatiquement quand toutes les annonces sont publiées. Il suffit de changer le délai de 48h à 24h.

---

### Étape 4 — Adapter le frontend pour le mode automatisé

- `AuctionLiveAnnouncements` : révéler les annonces progressivement selon `published_at` (une toutes les 10s) au lieu d'attendre que l'admin les publie manuellement
- `AuctionValidationConfirmation` : afficher un message clair quand tous les managers ont validé ("Fermeture automatique en cours...")
- Le `RoundControlCenter` (admin) reste inchangé pour permettre une intervention manuelle si nécessaire

---

### Résumé technique des fichiers à modifier

| Fichier | Modification |
|---------|-------------|
| `supabase/functions/auction-submit-all-bids/index.ts` | Remplacer la vérification roster-complete par validation-complete (tous les managers éligibles ont des bids pending) |
| `supabase/functions/clore-round/index.ts` | Ajouter un paramètre `auto_mode` ; si auto, appeler `publier-annonce` avec `publish_all: true` après création des annonces |
| `supabase/functions/publier-annonce/index.ts` | Changer le délai inter-annonces de 1s à 10s dans les timestamps ; changer le deadline du nouveau round de 48h à 24h |
| `src/components/auction/v2/AuctionLiveAnnouncements.tsx` | Adapter pour révéler les annonces progressivement basé sur `published_at` (timer côté client, une toutes les 10s) |
| `src/components/auction/v2/AuctionValidationConfirmation.tsx` | Ajouter un état "fermeture automatique en cours" quand validated_count === total_managers |

### Ce qui ne change PAS
- L'UX/UI des enchères (placement, validation, annonces visuelles)
- Le `RoundControlCenter` admin (reste disponible en backup)
- La logique de résolution des enchères dans `clore-round`
- Le système de notifications

