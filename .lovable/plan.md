

# Refactoring de la page Résultats Mobile

## Objectif

Simplifier l'interface de la page Résultats mobile :
- Supprimer le titre "Résultats"
- Supprimer le filtre par phase
- Harmoniser visuellement les vignettes de courses

---

## Aperçu visuel

### Avant

```text
┌─────────────────────────────┐
│ Résultats                   │  ← Titre
│ [Sélectionner une phase ▼]  │  ← Filtre phase
│ [🔍 Rechercher...]          │  ← Barre recherche
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ Course Name    [WT]     │ │
│ │ 📅 1 Jan → 21 Jan       │ │
│ │ ┌─────────────────────┐ │ │
│ │ │ 🏆 Tadej Pogacar    │ │ │  ← Fond jaune/amber
│ │ └─────────────────────┘ │ │
│ │ PODIUM MANAGERS         │ │  ← Label en majuscules
│ │ 🥇 Manager 1    120 pts │ │
│ │ 🥈 Manager 2    95 pts  │ │
│ │ 🥉 Manager 3    80 pts  │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

### Après

```text
┌─────────────────────────────┐
│ [🔍 Rechercher...]          │  ← Seulement la recherche
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ Course Name    [WT]     │ │
│ │ 📅 1 Jan → 21 Jan       │ │
│ │                         │ │
│ │ 🏆 Tadej Pogacar        │ │  ← Style simplifié
│ │                         │ │
│ │ ─────────────────────── │ │  ← Séparateur discret
│ │ 🥇 Manager 1    120 pts │ │  ← Sans label "PODIUM"
│ │ 🥈 Manager 2    95 pts  │ │
│ │ 🥉 Manager 3    80 pts  │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

---

## Modifications

### Fichier : `src/pages/ResultsPage.mobile.tsx`

#### 1. Supprimer le titre (lignes 170-174)

Supprimer le bloc :
```tsx
<div className="flex items-center justify-between">
  <div>
    <h1 className="text-xl font-bold">{t('title')}</h1>
  </div>
</div>
```

#### 2. Supprimer le filtre phase (lignes 176-190)

Supprimer le bloc `Select` complet pour les phases.

Aussi supprimer l'état `selectedPhaseId` (ligne 60) et les imports `Select*` (ligne 10).

#### 3. Simplifier le style du vainqueur (lignes 257-262)

Remplacer le style gradient jaune par un style plus discret :

```tsx
{/* Winner section - clean and simple */}
{raceWinner && (
  <div className="flex items-center gap-2 mt-3">
    <Trophy className="h-4 w-4 text-yellow-500 flex-shrink-0" />
    <span className="font-medium text-sm text-foreground">{raceWinner.coureur_nom}</span>
  </div>
)}
```

#### 4. Supprimer le label "PODIUM MANAGERS" (lignes 267-268)

Supprimer :
```tsx
<div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
  {t('podium.managers')}
</div>
```

#### 5. Harmoniser les items du podium (lignes 270-297)

Simplifier le style des lignes podium :
```tsx
{racePodium.slice(0, 3).map((manager, idx) => (
  <div 
    key={manager.manager_nom} 
    className="flex items-center justify-between py-1"
  >
    <div className="flex items-center gap-2">
      {jerseys[manager.manager_id] ? (
        <img 
          src={jerseys[manager.manager_id]} 
          alt="Maillot" 
          className="h-5 w-5 object-contain" 
        />
      ) : (
        <span className="text-sm">
          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
        </span>
      )}
      <span className="text-sm text-muted-foreground truncate max-w-[140px]">
        {manager.manager_nom}
      </span>
    </div>
    <span className="text-sm font-medium tabular-nums">
      {manager.points} pts
    </span>
  </div>
))}
```

#### 6. Nettoyer les imports inutilisés

Supprimer de la ligne 10 :
- `Select, SelectContent, SelectItem, SelectTrigger, SelectValue`

---

## Résumé des changements

| Élément | Avant | Après |
|---------|-------|-------|
| Titre | "Résultats" en h1 | Supprimé |
| Filtre phase | Select dropdown | Supprimé (toujours "global") |
| Vainqueur | Fond gradient jaune/amber | Style simple avec icône |
| Label podium | "PODIUM MANAGERS" en majuscules | Supprimé |
| Lignes podium | Fond hover, texte gras, couleur primaire | Style discret, texte gris, taille uniforme |
| Espacement | Padding/marges importants | Plus compact |

---

## Impact technique

- **selectedPhaseId** devient hardcodé à `"global"` dans l'appel API (ligne 95)
- Aucun changement backend nécessaire
- Les traductions `phase.*` ne seront plus utilisées sur mobile

