# 🏆 Guide d'intégration du système de Ligues

## ✅ Ce qui est fait

### Phase 1 - Migration base de données
- ✅ Tables créées : `leagues`, `league_members`, `league_scopes`
- ✅ Colonne `league_id` ajoutée à : `rosters`, `auctions`, `bids`, `points_ledger`
- ✅ Fonctions RLS : `is_league_member()`, `is_league_admin()`
- ✅ Policies RLS configurées
- ✅ Vues V2 : `v_manager_standings_by_season_v2`, `v_manager_standings_by_phase_v2`

### Phase 2 - Ligue Legacy
- ✅ Ligue "Ligue Legacy" créée automatiquement
- ✅ Tous les managers existants ajoutés comme membres
- ✅ Toutes les données existantes backfillées avec league_id

### Phase 3 - Frontend (ACTUEL)
- ✅ **Contexte** : `LeagueContext` avec hooks `useLeague()`
- ✅ **Storage** : Persistance localStorage + URL params
- ✅ **Composants UI** :
  - `LeagueSwitcher` - Sélecteur de ligue dans le header
  - `CreateLeagueDialog` - Création de nouvelle ligue
  - `JoinLeagueDialog` - Rejoindre une ligue publique
- ✅ **Hooks** :
  - `useUserLeagues()` - Liste des ligues de l'utilisateur
  - `useLeagueStandings*()` - Classements par ligue
- ✅ **Edge Functions** :
  - `leagues-create` - Créer une ligue
  - `leagues-join` - Rejoindre une ligue publique

## 📋 Prochaines étapes d'intégration

### 1. Adapter les pages de classement

**Fichiers à modifier** : `src/pages/Rankings.tsx`, `src/pages/Rankings.mobile.tsx`

```typescript
import { useLeague } from "@/contexts/LeagueContext";
import { useLeagueStandingsBySeason } from "@/hooks/useLeagueStandings";

// Dans le composant
const { leagueId } = useLeague();
const { selectedSeason } = useSeasonContext();

// Remplacer les anciens hooks par:
const { data: standings } = useLeagueStandingsBySeason(leagueId, selectedSeason?.id || null);
```

### 2. Adapter les enchères (Bids)

**Fichiers à modifier** : `src/components/auction/*`

```typescript
import { useLeague } from "@/contexts/LeagueContext";

// Lors de la création d'une enchère
const { leagueId } = useLeague();

await supabase.from('bids').insert({
  auction_id,
  manager_id,
  coureur_id,
  montant,
  statut: 'pending',
  league_id: leagueId, // ← AJOUTER
});
```

### 3. Adapter les rosters (Équipes)

**Fichiers à modifier** : `src/components/team/*`

```typescript
// Lecture avec filtre
const { leagueId } = useLeague();

const { data: rosters } = useQuery({
  queryKey: ['rosters', managerId, phaseId, leagueId],
  queryFn: async () => {
    let query = supabase
      .from('rosters')
      .select('*')
      .eq('manager_id', managerId)
      .eq('phase_id', phaseId);
    
    if (leagueId) {
      query = query.eq('league_id', leagueId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
});
```

### 4. Adapter les points

**Fichiers à modifier** : Tous les composants affichant des points

```typescript
// Utiliser les vues V2 avec league_id
const { data: points } = useQuery({
  queryFn: async () => {
    const { data, error } = await supabase
      .from('v_manager_standings_by_phase_v2')
      .select('*')
      .eq('league_id', leagueId)
      .eq('phase_id', phaseId);
    
    if (error) throw error;
    return data;
  },
});
```

## 🔐 Sécurité RLS

### Lectures (SELECT)
✅ **Ouvertes** : Tout le monde peut voir toutes les données
- C'est voulu pour permettre la consultation des classements

### Écritures (INSERT/UPDATE/DELETE)
✅ **Protégées** : 
- Si `league_id IS NULL` → Accès libre (données Legacy)
- Si `league_id IS NOT NULL` → Accès réservé aux membres de la ligue via `is_league_member(league_id)`

### Gestion des ligues
- **Création** : Tout manager authentifié
- **Join publique** : Via Edge Function (contrôle applicatif)
- **Modification** : Réservée owner/admin via `is_league_admin()`

## 🧪 Tests à effectuer

### Test 1 : Continuité Legacy
```bash
✓ Se connecter sans changer de ligue
✓ Vérifier que toutes les données s'affichent
✓ Vérifier que les classements fonctionnent
✓ Vérifier qu'on peut enchérir
```

### Test 2 : Création de ligue
```bash
✓ Créer une nouvelle ligue (publique ou privée)
✓ Vérifier qu'on bascule automatiquement dessus
✓ Vérifier que les données sont vides (normal, nouvelle ligue)
✓ Vérifier qu'on peut y créer des enchères
```

### Test 3 : Rejoindre une ligue
```bash
✓ Avec un autre compte, rejoindre la ligue publique
✓ Vérifier qu'on peut voir les données de cette ligue
✓ Vérifier qu'on peut enchérir dans cette ligue
```

### Test 4 : Persistance
```bash
✓ Changer de ligue
✓ Rafraîchir la page
✓ Vérifier que la ligue sélectionnée est conservée
✓ Vérifier que l'URL contient ?leagueId=...
```

### Test 5 : Multi-onglets
```bash
✓ Ouvrir 2 onglets
✓ Changer de ligue dans un onglet
✓ L'autre onglet doit se synchroniser automatiquement
```

## 🐛 Debugging

### Logs utiles
```typescript
// Dans les composants
const { leagueId, isLegacy } = useLeague();
console.log('Current league:', leagueId, 'is legacy:', isLegacy);
```

### Vérifier RLS
```sql
-- Voir les policies actives
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('leagues', 'league_members', 'rosters', 'bids', 'auctions', 'points_ledger')
ORDER BY tablename, policyname;
```

### Vérifier les données
```sql
-- Ligue Legacy
SELECT * FROM leagues WHERE name ILIKE '%legacy%';

-- Membres d'une ligue
SELECT lm.*, m.nom as manager_nom 
FROM league_members lm 
JOIN managers m ON m.user_id = lm.user_id
WHERE league_id = '<league_id>';

-- Données par ligue
SELECT league_id, COUNT(*) 
FROM rosters 
GROUP BY league_id;
```

## 📝 Checklist d'intégration complète

- [x] Phase 1 : Migration tables + RLS
- [x] Phase 2 : Backfill Legacy
- [x] Phase 3 : Context + UI Components + Edge Functions
- [ ] Adapter page Classement (Rankings)
- [ ] Adapter page Équipes (MyTeam)
- [ ] Adapter page Enchères (Auction)
- [ ] Adapter page Résultats
- [ ] Adapter composants de statistiques
- [ ] Tests end-to-end
- [ ] Documentation utilisateur

## 🚀 Prochaines fonctionnalités

### Court terme
- Invitations à des ligues privées
- Gestion des membres (promouvoir admin, expulser)
- Paramètres de ligue (règles personnalisées)

### Moyen terme
- Ligues par GT uniquement
- Ligues par périodes (ex: Printemps, Automne)
- Historique des ligues passées
- Statistiques inter-ligues

### Long terme
- Tournois multi-ligues
- Système de divisions (promotion/relégation)
- API publique pour statistiques de ligues
