

# Optimisation UX de la page Mon Équipe (Mobile)

## Analyse des problèmes actuels

En regardant la capture d'écran, voici les problèmes identifiés :

| Problème | Impact UX |
|----------|-----------|
| **Header trop dense** | Maillot + 2 sélecteurs côte à côte = difficile à scanner |
| **3 KPIs en cartes séparées** | Prennent beaucoup d'espace vertical |
| **3 boutons d'action empilés** | Zone d'action floue, pas de hiérarchie |
| **6 chips de tri** | Trop d'options visibles, surcharge cognitive |
| **Cartes coureurs volumineuses** | Informations métier (R3, ratio) en ligne dense |

---

## Solution proposée

### Aperçu avant/après

**AVANT**
```text
┌─────────────────────────────────────────┐
│ [🎽]  [Mon équipe ▼]  [Phase 1 ▼]       │
├─────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│ │ Points   │ │ Bonus    │ │ Scoreurs │  │
│ │ 415      │ │ 0        │ │ 5        │  │
│ └──────────┘ └──────────┘ └──────────┘  │
├─────────────────────────────────────────┤
│ [⭐ Coureurs bonusés] [👁 Voir] [👥 Eff]│
├─────────────────────────────────────────┤
│ [Ratio][Prix][Cote][Coureur][Équipe]    │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ Pierre GAUTHERAT 📅   🏆 110        │ │
│ │ Decathlon CMA CGM Team              │ │
│ │ 55 R3 / 20 • Ratio: 2.00            │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**APRÈS**
```text
┌─────────────────────────────────────────┐
│ [🎽]  [Mon équipe ▼]  [Phase 1 ▼]       │  ← Garde l'essentiel
├─────────────────────────────────────────┤
│  415 pts    │   0 bonus   │   5/8       │  ← Bande compacte
├─────────────────────────────────────────┤
│ [Points ▼] ───────────── [👥] [⭐] [📊] │  ← Tri + icônes
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ Pierre GAUTHERAT ⭐📅     110 pts   │ │  ← Nom + badge pts
│ │ Decathlon • 55 (R3) / 20            │ │  ← Infos simplifiées
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## Modifications détaillées

### 1. Remplacer KPIRow par une bande compacte inline

**Fichier** : `src/components/team/MyTeamMobile.tsx`

Remplacer les 3 cartes KPI par une simple ligne de texte :

```tsx
{/* Stats compactes - une seule ligne */}
<div className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-xl text-sm">
  <div className="flex items-center gap-1">
    <Trophy className="h-4 w-4 text-primary" />
    <span className="font-semibold">{kpis.total_points}</span>
    <span className="text-muted-foreground">pts</span>
  </div>
  
  <div 
    className="flex items-center gap-1 cursor-pointer" 
    onClick={() => setBonusDetailsOpen(true)}
  >
    <Star className="h-4 w-4 text-amber-500" />
    <span className="font-semibold">{kpis.bonus_points}</span>
    <span className="text-muted-foreground">bonus</span>
  </div>
  
  <div className="flex items-center gap-1 text-muted-foreground">
    <TrendingUp className="h-4 w-4" />
    <span>{kpis.scorers_count}/{coureurs.length}</span>
  </div>
</div>
```

### 2. Simplifier la zone d'actions en icônes

Remplacer les 3 boutons textuels par des icônes compactes à droite d'un Select de tri :

```tsx
{/* Barre tri + actions */}
<div className="flex items-center gap-2">
  {/* Select de tri (remplace les 6 chips) */}
  <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
    <SelectTrigger className="flex-1 h-9">
      <SelectValue placeholder="Trier par..." />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="points">Points</SelectItem>
      <SelectItem value="ratio">Ratio</SelectItem>
      <SelectItem value="prix">Prix</SelectItem>
      <SelectItem value="cote">Cote</SelectItem>
      <SelectItem value="nom">Coureur</SelectItem>
      <SelectItem value="equipe">Équipe</SelectItem>
    </SelectContent>
  </Select>
  
  {/* Boutons icônes */}
  <Button variant="ghost" size="icon" onClick={() => setShowRostersOverviewDialog(true)}>
    <Users className="h-5 w-5" />
  </Button>
  <Button variant="ghost" size="icon" onClick={() => setShowLeagueBonusDialog(true)}>
    <Eye className="h-5 w-5" />
  </Button>
  {!hasSelectedBonusRider && !selectedManagerId && (
    <Button variant="ghost" size="icon" onClick={() => setShowBonusRiderDialog(true)}>
      <Star className="h-5 w-5" />
    </Button>
  )}
</div>
```

### 3. Simplifier les cartes coureurs

Réduire la densité d'information dans les cartes :

```tsx
<MobileCard
  key={coureur.coureur_id}
  title={
    <div className="flex items-center gap-1.5">
      {bonusRiderSelection?.coureur_id === coureur.coureur_id && (
        <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
      )}
      <span className="truncate">{coureur.nom}</span>
      <RiderRaceIcons ... />
    </div>
  }
  subtitle={
    <span className="text-xs text-muted-foreground">
      {coureur.equipe} • {coureur.prix_achat}
      {coureur.winning_round && <span className="opacity-60"> (R{coureur.winning_round})</span>}
      {' / '}{coureur.cote_initiale}
    </span>
  }
  badge={
    <span className="font-bold text-base text-primary">
      {coureur.points_total} pts
    </span>
  }
  onClick={() => openCoureurDetail(coureur)}
  className="py-2.5"
/>
```

**Ce qui change** :
- Suppression du label "Ratio: X.XX" de la ligne meta
- Fusion équipe + prix + cote sur une seule ligne subtitle
- Badge simplifié sans icône Trophy

### 4. Supprimer les imports inutilisés

- Supprimer `ChipGroup` car remplacé par un Select
- Supprimer `KPIRow` car remplacé par la bande inline

---

## Résumé des gains

| Élément | Avant | Après |
|---------|-------|-------|
| Lignes KPI | 3 cartes (≈80px hauteur) | 1 ligne (≈40px) |
| Boutons action | 3 boutons avec texte | 2-3 icônes compactes |
| Chips de tri | 6 badges scrollables | 1 Select dropdown |
| Carte coureur | 3 lignes d'info | 2 lignes |
| **Gain total** | | **≈120px économisés** |

---

## Fichiers impactés

| Fichier | Modification |
|---------|--------------|
| `src/components/team/MyTeam.mobile.tsx` | Refactoring header, KPIs, actions, cartes |

Aucune modification backend nécessaire.

