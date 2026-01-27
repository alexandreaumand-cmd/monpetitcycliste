
# Réorganisation de la fiche coureur (RiderPointsDetail)

## Objectif

Réorganiser l'affichage des informations du coureur avec :
1. Nom et équipe en header
2. 6 vignettes compactes pour les stats
3. Détail des points par course
4. Programme à venir

---

## Aperçu visuel

### Avant

```text
┌─────────────────────────────────────────┐
│ Pierre GAUTHERAT                        │
│ Decathlon CMA CGM Team - Prix: 55       │  ← Prix dans le header
├─────────────────────────────────────────┤
│ ┌──────────┐    ┌──────────┐            │
│ │   415    │    │    5     │            │  ← Cartes volumineuses
│ │ Points   │    │ Courses  │            │
│ └──────────┘    └──────────┘            │
│ ┌──────────┐    ┌──────────┐            │
│ │    2     │    │   7.55   │            │
│ │ Victoires│    │ Ratio    │            │
│ └──────────┘    └──────────┘            │
└─────────────────────────────────────────┘
```

### Après

```text
┌─────────────────────────────────────────┐
│ Pierre GAUTHERAT                        │
│ Decathlon CMA CGM Team                  │  ← Équipe seule
├─────────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐                 │
│ │ 415 │ │ 55  │ │  2  │                 │  ← Grille 3 colonnes
│ │ pts │ │ prix│ │ vic │                 │     compacte
│ └─────┘ └─────┘ └─────┘                 │
│ ┌─────┐ ┌─────┐ ┌─────┐                 │
│ │ 20  │ │7.55 │ │  5  │                 │
│ │ cote│ │ratio│ │cours│                 │
│ └─────┘ └─────┘ └─────┘                 │
├─────────────────────────────────────────┤
│ Détails par course                      │
│ ...                                     │
├─────────────────────────────────────────┤
│ Programme à venir                       │
│ ...                                     │
└─────────────────────────────────────────┘
```

---

## Modifications

### Fichier : `src/components/team/RiderPointsDetail.tsx`

#### 1. Ajouter la cote comme prop

La cote (`cote_initiale`) doit être passée au composant :

```typescript
interface RiderPointsDetailProps {
  // ... existing props
  riderCote?: number;  // Nouvelle prop
}
```

#### 2. Modifier le header du MobileBottomSheet

Retirer le prix du header pour ne garder que l'équipe :

```tsx
<MobileBottomSheet
  open={isOpen}
  onOpenChange={onClose}
  title={riderName}
  description={riderTeam}  // Équipe seule, sans le prix
>
```

#### 3. Remplacer la grille 2x2 par une grille 3x2 compacte

Ordre des stats selon la demande :
1. Points | Prix | Victoires
2. Cote | Ratio | Courses avec points

```tsx
<div className="grid grid-cols-3 gap-2">
  {/* Ligne 1 */}
  <div className="text-center p-2 rounded-lg border bg-card">
    <div className="text-xl font-bold text-primary">{riderStats.totalPoints}</div>
    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Points</div>
  </div>
  <div className="text-center p-2 rounded-lg border bg-card">
    <div className="text-xl font-bold">{riderPrice}</div>
    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Prix</div>
  </div>
  <div className="text-center p-2 rounded-lg border bg-card">
    <div className="text-xl font-bold text-yellow-600">{riderStats.wins}</div>
    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Victoires</div>
  </div>
  
  {/* Ligne 2 */}
  <div className="text-center p-2 rounded-lg border bg-card">
    <div className="text-xl font-bold">{riderCote || '-'}</div>
    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Cote</div>
  </div>
  <div className="text-center p-2 rounded-lg border bg-card">
    <div className={`text-xl font-bold ${getRatioColor(riderStats.ratio)}`}>
      {riderStats.ratio}
    </div>
    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Ratio</div>
  </div>
  <div className="text-center p-2 rounded-lg border bg-card">
    <div className="text-xl font-bold">{riderStats.totalRaces}</div>
    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Courses</div>
  </div>
</div>
```

#### 4. Mettre à jour l'appel dans MyTeam.mobile.tsx

Passer la cote au composant :

```tsx
<RiderPointsDetail
  isOpen={!!selectedRider}
  onClose={() => setSelectedRider(null)}
  riderId={selectedRider?.id || ''}
  riderName={selectedRider?.nom || ''}
  riderTeam={selectedRider?.equipe || ''}
  riderPrice={selectedRider?.prix || 0}
  riderCote={selectedRider?.cote || 0}  // Nouvelle prop
  phaseId={selectedPhaseId || ''}
/>
```

Et mettre à jour l'état `selectedRider` pour inclure la cote :

```tsx
const [selectedRider, setSelectedRider] = useState<{
  id: string;
  nom: string;
  equipe: string;
  prix: number;
  cote: number;  // Ajouter
} | null>(null);

const openCoureurDetail = (coureur: Coureur) => {
  setSelectedRider({
    id: coureur.coureur_id,
    nom: coureur.nom,
    equipe: coureur.equipe,
    prix: coureur.prix_achat,
    cote: coureur.cote_initiale  // Ajouter
  });
};
```

---

## Résumé des changements

| Élément | Avant | Après |
|---------|-------|-------|
| Header description | `Équipe - Prix: X` | `Équipe` seule |
| Grille stats | 2 colonnes, 4 cases | 3 colonnes, 6 cases |
| Taille texte valeurs | `text-3xl` | `text-xl` |
| Taille labels | `text-sm` | `text-[10px] uppercase` |
| Padding cards | `p-4` | `p-2` |
| Hauteur totale stats | ~160px | ~100px |

---

## Fichiers impactés

| Fichier | Modification |
|---------|--------------|
| `src/components/team/RiderPointsDetail.tsx` | Nouvelle prop `riderCote`, header simplifié, grille 3x2 compacte |
| `src/components/team/MyTeam.mobile.tsx` | Passer `riderCote` au composant, état `selectedRider` étendu |
