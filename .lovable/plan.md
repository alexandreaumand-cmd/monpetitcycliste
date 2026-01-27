
# Mise en avant des coureurs de mon équipe (fond jaune, sans badge)

## Objectif

Remplacer le style actuel des lignes "mon équipe" par un fond jaune discret, et supprimer toutes les vignettes/étoiles "Mon équipe".

---

## Changements actuels vs proposés

| Élément | Avant | Après |
|---------|-------|-------|
| Fond de ligne | `bg-primary/5` (bleu clair) | `bg-yellow-100/60 dark:bg-yellow-900/20` |
| Bordure gauche | `border-l-2 border-l-primary` | `border-l-2 border-l-yellow-400` |
| Badge "Mon équipe" | Visible | Supprimé |
| Étoile ⭐ | Visible | Supprimée |

---

## Fichiers impactés

### 1. CourseResultsDrawer.tsx

**4 endroits à modifier :**

#### A. Ligne 643-644 (Onglet Finals - tableau principal)
```tsx
// Avant
: row.is_my_rider 
  ? "bg-primary/5 border-l-2 border-l-primary" 

// Après
: row.is_my_rider 
  ? "bg-yellow-100/60 dark:bg-yellow-900/20 border-l-2 border-l-yellow-400" 
```

#### B. Ligne 678 - Supprimer l'étoile ⭐
```tsx
// Avant
<div className="flex items-center gap-0.5">
  <span className="font-semibold leading-tight truncate">{row.coureur_nom}</span>
  {row.is_my_rider && <span className="text-[8px]">⭐</span>}
</div>

// Après
<span className="font-semibold leading-tight truncate">{row.coureur_nom}</span>
```

#### C. Ligne 763-764 (Onglet Stages - tableau étapes)
```tsx
// Avant
: row.is_my_rider 
  ? "bg-primary/5 border-l-2 border-l-primary" 

// Après
: row.is_my_rider 
  ? "bg-yellow-100/60 dark:bg-yellow-900/20 border-l-2 border-l-yellow-400" 
```

#### D. Lignes 996-997 + 1035-1038 (Onglet Results - tableau simple)
Style de ligne :
```tsx
// Avant
: row.is_my_rider 
  ? "bg-primary/5 border-l-2 border-l-primary" 

// Après
: row.is_my_rider 
  ? "bg-yellow-100/60 dark:bg-yellow-900/20 border-l-2 border-l-yellow-400" 
```

Supprimer le badge :
```tsx
// Supprimer ces lignes (1035-1038)
{row.is_my_rider && (
  <Badge variant="default" className="text-[9px] px-1 py-0 leading-tight">
    Mon équipe
  </Badge>
)}
```

---

### 2. StageJerseyBonuses.tsx

#### Lignes 71-73 + 88-90

Style du container :
```tsx
// Avant
${bonus.is_my_rider 
  ? 'bg-primary/5 border-primary border-2' 
  : 'bg-card hover:bg-muted/50'}

// Après
${bonus.is_my_rider 
  ? 'bg-yellow-100/60 dark:bg-yellow-900/20 border-yellow-400 border-2' 
  : 'bg-card hover:bg-muted/50'}
```

Supprimer le badge :
```tsx
// Supprimer ces lignes (88-90)
{bonus.is_my_rider && (
  <Badge variant="default" className="text-[10px] px-1 py-0">
    Mon équipe
  </Badge>
)}
```

---

## Résultat visuel

```text
┌────────────────────────────────────────────────────┐
│ # │ Coureur                      │ Pts │ Manager  │
├────────────────────────────────────────────────────┤
│ 1 │ MILAN J.                     │ 25  │ Bubu     │
│ 2 │ PHILIPSEN J.                 │ 20  │ Max      │
│▐3 │ PEDERSEN M.    [fond jaune]  │ 16  │ -        │ ← Mon coureur
│ 4 │ ACKERMANN P.                 │ 14  │ Fab      │
└────────────────────────────────────────────────────┘
```

La ligne est mise en avant par :
- Un fond jaune léger (`bg-yellow-100/60`)
- Une bordure jaune à gauche (`border-l-yellow-400`)
- Pas de badge ni d'étoile

---

## Récapitulatif des modifications

| Fichier | Lignes | Action |
|---------|--------|--------|
| `CourseResultsDrawer.tsx` | 643-644 | Changer style → jaune |
| `CourseResultsDrawer.tsx` | 676-679 | Supprimer étoile ⭐ |
| `CourseResultsDrawer.tsx` | 763-764 | Changer style → jaune |
| `CourseResultsDrawer.tsx` | 996-997 | Changer style → jaune |
| `CourseResultsDrawer.tsx` | 1035-1038 | Supprimer badge "Mon équipe" |
| `StageJerseyBonuses.tsx` | 71-73 | Changer style → jaune |
| `StageJerseyBonuses.tsx` | 88-90 | Supprimer badge "Mon équipe" |
