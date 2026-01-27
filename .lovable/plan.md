
# Correction de l'affichage mobile des startlists

## Problemes identifies

### 1. Couleur des coureurs
La liste des coureurs est affichee en noir (couleur par defaut). L'utilisateur souhaite un gris discret.

**Fichier** : `src/pages/Startlist.mobile.tsx` ligne 522

### 2. Place au CG non affichee
Le classement general (CG) ne s'affiche pas car la fonction Edge appelle une vue qui n'existe pas.

**Cause** : La fonction Edge `startlist-manager-view` (ligne 308) appelle `v_manager_standings_total_v2` mais cette vue n'existe pas. La vue correcte est `v_manager_standings_by_season_v2`.

---

## Modifications

### 1. Couleur grise pour les coureurs

**Fichier** : `src/pages/Startlist.mobile.tsx`

Ligne 522, ajouter `text-muted-foreground` :

```tsx
// Avant
<p key={starter.coureur_id} className="text-sm mx-[60px]">
  {starter.nom}
</p>

// Apres
<p key={starter.coureur_id} className="text-sm mx-[60px] text-muted-foreground">
  {starter.nom}
</p>
```

### 2. Corriger la requete CG dans la fonction Edge

**Fichier** : `supabase/functions/startlist-manager-view/index.ts`

Lignes 306-316, remplacer l'appel a la vue inexistante par la bonne vue avec filtre `saison_id` :

```typescript
// Avant
let totalStandingsQuery = supabase
  .from('v_manager_standings_total_v2')
  .select('*');

if (league_id) {
  totalStandingsQuery = totalStandingsQuery.eq('league_id', league_id);
}

const { data: totalStandings } = await totalStandingsQuery
  .order('total_points', { ascending: false });

// Apres
let totalStandingsQuery = supabase
  .from('v_manager_standings_by_season_v2')
  .select('*')
  .eq('saison_id', saisonId);

if (league_id) {
  totalStandingsQuery = totalStandingsQuery.eq('league_id', league_id);
}

const { data: totalStandings } = await totalStandingsQuery
  .order('total_points', { ascending: false });
```

---

## Resultat attendu

| Element | Avant | Apres |
|---------|-------|-------|
| Couleur coureurs | Noir (defaut) | Gris (`text-muted-foreground`) |
| Affichage CG | `CG: #-` (toujours vide) | `CG: #1`, `CG: #2`, etc. |

En Phase 1, le CG et la Phase afficheront le meme rang (ce qui est logique puisqu'il n'y a qu'une seule phase).
