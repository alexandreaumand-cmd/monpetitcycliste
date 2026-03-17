

## Ajouter le nom de la ligue dans toutes les notifications

### Problème
Le screenshot montre que les notifications d'enchères n'affichent pas la ligue concernée. Le `league_name` est déjà présent dans les metadata des notifications `auction_opened`, mais il manque dans `auction_closed` et `auction_validation`. De plus, les traductions i18n et l'UI n'exploitent pas ce champ pour tous les types.

### Changements

#### 1. Backend — Ajouter `league_name` aux metadata manquantes

**`supabase/functions/clore-round/index.ts`** (~ligne 273-279) :
- Fetcher le nom de la ligue et l'ajouter dans metadata : `league_name`

**`supabase/functions/auction-submit-all-bids/index.ts`** (~ligne 419-426) :
- Fetcher le nom de la ligue et l'ajouter dans metadata : `league_name`

#### 2. Frontend — Afficher le nom de la ligue comme sous-titre

**`src/components/layout/NotificationCenter.tsx`** (~ligne 175-179) :
- En plus de `race_name`, afficher `league_name` depuis metadata pour les notifications d'enchères (quand `race_name` n'est pas défini)

#### 3. Traductions — Ajouter `{{leagueName}}` dans les messages

**`src/i18n/locales/fr/navigation.json`** :
- `auction_closed.message` : `"Le round {{round}} est terminé dans {{leagueName}}."`
- `auction_validation.message` : `"Un manager a validé dans {{leagueName}}. En attente des autres..."`
- `auction_ready_to_close.message` : `"Tous les managers ont validé dans {{leagueName}}."`

**`src/i18n/locales/en/navigation.json`** : mêmes ajouts en anglais

