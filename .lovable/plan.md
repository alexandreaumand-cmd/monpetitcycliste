

# Générer l'image automatiquement à l'ouverture du dialog

## Objectif

Supprimer l'étape intermédiaire "Générer l'aperçu" et générer l'image automatiquement dès que le dialog s'ouvre et que les données sont chargées.

---

## Modification

### Fichier : `src/components/admin/ExportResultsImage.tsx`

**1. Ajouter un useEffect pour déclencher la génération automatique** (après ligne 52)

```typescript
// Générer l'image automatiquement quand les données sont prêtes
useEffect(() => {
  const shouldGenerate = 
    open && 
    !isLoading && 
    !generatedImageUrl && 
    !isGenerating && 
    exportRef;
  
  if (shouldGenerate) {
    // Vérifier qu'il y a des données à exporter
    const hasData = 
      (topRiders && topRiders.length > 0) ||
      (jerseyHolders && jerseyHolders.length > 0);
    
    if (hasData) {
      handleGeneratePreview();
    }
  }
}, [open, isLoading, generatedImageUrl, isGenerating, exportRef, topRiders, jerseyHolders]);
```

**2. Simplifier l'affichage quand l'image n'est pas encore générée** (lignes 400-437)

Remplacer le bloc avec le bouton "Générer l'aperçu" par un simple état de chargement :

```typescript
{!generatedImageUrl ? (
  <div className="flex flex-col items-center justify-center py-8 space-y-4">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    <p className="text-sm text-muted-foreground">
      {isLoading ? "Chargement des données..." : "Génération de l'image..."}
    </p>
  </div>
) : (
  // ... reste du code pour l'affichage de l'image générée
)}
```

---

## Comportement attendu

| Étape | Avant | Après |
|-------|-------|-------|
| 1 | Clic sur partager → Dialog s'ouvre | Clic sur partager → Dialog s'ouvre |
| 2 | Voir info + bouton "Générer l'aperçu" | Voir spinner "Génération de l'image..." |
| 3 | Clic sur "Générer l'aperçu" | (automatique) |
| 4 | Image générée, boutons partage | Image générée, boutons partage |

---

## Récapitulatif

- **Ajout** : useEffect pour trigger automatique de `handleGeneratePreview()`
- **Suppression** : Bouton "Générer l'aperçu" et texte d'info intermédiaire
- **Affichage** : Simple spinner pendant le chargement/génération

