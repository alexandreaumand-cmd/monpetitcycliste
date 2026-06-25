## Nouvelle page Super Admin : "Rosters globaux"

Vue centralisée pour vérifier rapidement si un coureur (ex. vainqueur d'un CN) est détenu par au moins un manager, dans n'importe quelle ligue/phase, avant de saisir un résultat.

### Emplacement

Nouvelle entrée **"Rosters globaux"** dans le groupe **"Ligues & Arène"** du menu Super Admin (desktop + mobile), icône `Users2`, route `/dashboard/super-admin/global-rosters`.

### Écran

Un tableau unique listant **une ligne par roster** (coureur détenu par un manager dans une phase d'une ligue), avec :

**Colonnes**
- Coureur (nom + photo si dispo)
- Équipe saison
- Cote actuelle (`coureurs_saisons.cote`)
- Manager (nom + avatar)
- Ligue (nom + badge type "à la phase" / "à la course")
- Phase (numéro + nom)
- Prix payé (`rosters.prix_signature`)
- Round d'achat (récupéré via jointure `bids` gagnants → `auctions.round`)

**Filtres en haut de page**
- Recherche coureur (autocomplete)
- Recherche manager
- Sélecteur ligue (multi)
- Sélecteur phase (1 à 5)
- Sélecteur saison (via `LeagueContext` / `SeasonContext`)
- Type de ligue (à la phase / à la course / toutes)
- Toggle "Coureurs non détenus" (à terme — voir note plus bas)

**Comportements**
- Pagination serveur (50 lignes/page) car volume important (124 managers × N ligues × 5 phases × ~20 coureurs).
- Tri colonnes : coureur, cote (desc), prix (desc), manager, ligue.
- Compteur en haut : "X rosters · Y coureurs uniques détenus · Z managers".
- Export CSV du résultat filtré.

### Cas d'usage principal (workflow CN)

Tu tapes "Langelotti" dans le filtre coureur : si le tableau est vide → personne ne le détient → tu ne saisis pas le résultat. Sinon tu vois exactement qui, dans quelle ligue/phase, à quel prix.

### Détails techniques

**Source de données** : nouvelle vue SQL `v_global_rosters` qui joint :
```
rosters
  → coureurs_saisons (cote, équipe)
  → coureurs (nom)
  → managers (nom)
  → leagues (nom, template_id → "à la phase"/"à la course")
  → phases (numéro)
  → bids (winning_bid_id → round d'achat depuis auctions.round)
```

**Hook** : `useGlobalRosters({ filters, page })` avec React Query, debounced search, comptage séparé pour la pagination.

**Composants** :
- `src/pages/admin/SuperAdminGlobalRostersPage.tsx` (page)
- `src/components/admin/GlobalRostersFilters.tsx` (barre de filtres)
- `src/components/admin/GlobalRostersTable.tsx` (tableau + tri + pagination)
- Hook : `src/hooks/useGlobalRosters.ts`

**Sécurité** : accès via `SuperAdminGuard` (déjà en place sur les autres routes admin). Politique RLS sur la vue / RPC : `has_role(auth.uid(), 'super_admin')` uniquement. Pas de GRANT à anon.

**Routes ajoutées** dans `SuperAdminPage.desktop.tsx` et `SuperAdminPage.mobile.tsx`, plus l'item dans `navGroups` / `navSections` (groupe "Ligues & Arène").

### Note pour plus tard (hors scope)

Le toggle "Coureurs non détenus" implique de charger toute la `coureurs_saisons` et faire un anti-join — à implémenter dans un second temps si besoin, idéalement via une RPC dédiée. Pour ton workflow CN immédiat, la recherche par nom suffit.

### Hors scope

- Pas de modification des rosters depuis cet écran (lecture seule).
- Pas de changement sur la logique de saisie des résultats.
- Pas de modif UI des autres écrans Super Admin.