

# Repositionnement des boutons sur la startlist mobile

## Objectif

Améliorer l'esthétique de la page startlist mobile :
- **Bouton Partager** : Discret en haut à droite avec juste une icône
- **Bouton Noter** : En bas de page sans le fond noir

---

## Aperçu visuel

### Avant

```text
┌─────────────────────────────────────────┐
│ ← Retour              [SL officielle]   │
├─────────────────────────────────────────┤
│      ...contenu...                      │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐    │
│  │ 🔗 Partager la startlist        │    │  ← Bouton gradient pleine largeur
│  └─────────────────────────────────┘    │
├─────────────────────────────────────────┤
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓ ⭐ Noter les managers ▓▓▓▓▓▓▓▓▓▓▓▓▓│  ← Fond noir sticky
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
└─────────────────────────────────────────┘
```

### Après

```text
┌─────────────────────────────────────────┐
│ ← Retour    [SL officielle]  [📤]       │  ← Icône partage discrète
├─────────────────────────────────────────┤
│      ...contenu...                      │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ ⭐ Noter les managers           │    │  ← Bouton jaune classique
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

---

## Modifications techniques

### Fichier : `src/pages/Startlist.mobile.tsx`

#### 1. Déplacer l'icône partage dans le header (lignes 364-373)

Remplacer le header actuel par une version avec 3 éléments :

```tsx
<div className="flex items-center justify-between">
  <Button variant="ghost" size="sm" onClick={() => setViewMode("list")}>
    <ArrowLeft className="h-4 w-4 mr-2" />
    {t('startlist.back')}
  </Button>
  
  <div className="flex items-center gap-2">
    {startlistViewData.pcs_validated && (
      <Badge className="bg-green-600 text-white">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        SL officielle
      </Badge>
    )}
    
    {/* Bouton partage discret */}
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={handleShareStartlist} 
      disabled={isExporting}
      className="h-8 w-8"
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Share2 className="h-4 w-4 text-muted-foreground" />
      )}
    </Button>
  </div>
</div>
```

#### 2. Supprimer le bouton partage pleine largeur (lignes 529-540)

Supprimer entièrement ce bloc :

```tsx
{/* Bouton Partager - À SUPPRIMER */}
<div className="mt-4">
  <Button onClick={handleShareStartlist} ...>
    ...
  </Button>
</div>
```

#### 3. Remplacer MobileStickyBottom par un bouton simple (lignes 548-554)

Remplacer :

```tsx
{isAdmin && startlistViewData.managers.length > 0 && (
  <MobileStickyBottom>
    <Button className="w-full touch-target" onClick={() => setShowRatingModal(true)}>
      <Star className="h-4 w-4 mr-2" />
      {t('startlist.rateManagers')}
    </Button>
  </MobileStickyBottom>
)}
```

Par un bouton classique en bas du contenu (avant la fermeture du div principal) :

```tsx
{isAdmin && startlistViewData.managers.length > 0 && (
  <div className="mt-6 mb-4">
    <Button className="w-full touch-target" onClick={() => setShowRatingModal(true)}>
      <Star className="h-4 w-4 mr-2" />
      {t('startlist.rateManagers')}
    </Button>
  </div>
)}
```

---

## Résumé des changements

| Élément | Avant | Après |
|---------|-------|-------|
| Bouton Partager | Gradient, pleine largeur, en bas du contenu | Icône ghost, discret, en haut à droite |
| Bouton Noter | Sticky avec fond noir `MobileStickyBottom` | Bouton jaune classique en bas du contenu |
| Padding bottom | `pb-20` pour laisser place au sticky | `pb-4` suffisant |

---

## Comportement attendu

1. **Icône partage** : Apparaît toujours en haut à droite, devient un loader pendant l'export
2. **Bouton noter** : Visible uniquement pour les admins, style jaune standard, intégré au flux de la page
3. **Pas de sticky** : Plus de barre noire fixe en bas de l'écran

