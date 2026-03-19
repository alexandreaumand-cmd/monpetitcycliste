

## Plan : Fix bouton "Annonces" qui dépasse + nom du manager dans la notification de validation

### 1. Bouton "Annonces" qui dépasse du cadre
**Fichier** : `src/components/auction/v2/AuctionValidationConfirmation.tsx`

Le bloc d'actions (ligne 182) utilise `flex flex-col sm:flex-row` avec 4 boutons qui débordent sur petit écran. Corrections :
- Changer en grille 2×2 : `grid grid-cols-2 gap-2 pt-4` pour que les 4 boutons tiennent toujours dans le cadre
- Retirer `flex-1` des boutons, utiliser `w-full` à la place

### 2. Ajouter le nom du manager dans la notification "Enchères validées"
**Fichier** : `supabase/functions/auction-submit-all-bids/index.ts`
- À la ligne 45-49, le manager est récupéré avec `select('id')` → changer en `select('id, nom')` pour récupérer le nom
- Ligne 426 : remplacer `"Un manager a validé ses enchères"` par utiliser `manager.nom` dans le message
- Ajouter `manager_name: manager.nom` dans le metadata (ligne 427+)

**Fichier** : `src/i18n/locales/fr/navigation.json`
- Ligne 35 : `"message": "{{managerName}} a validé dans {{leagueName}}. En attente des autres managers..."`

**Fichier** : `src/i18n/locales/en/navigation.json`
- Ligne 35 : `"message": "{{managerName}} has validated in {{leagueName}}. Waiting for other managers..."`

