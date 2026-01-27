

# Afficher la photo du manager + lien vers le profil dans le MobileDrawer

## Modifications à apporter

### Fichier : `src/components/mobile/MobileDrawer.tsx`

**1. Ajouter les imports nécessaires**

```tsx
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
```

**2. Remplacer le bloc header (lignes 95-114)**

Rendre toute la zone **cliquable** pour naviguer vers `/dashboard/compte` et afficher la **photo du manager**.

| Élément | Avant | Après |
|---------|-------|-------|
| Conteneur | `<div>` statique | `<div>` cliquable avec `cursor-pointer` |
| Icône | `<div>` avec icône User fixe | `<Avatar>` avec photo conditionnelle |
| Action | Aucune | Navigation vers `/dashboard/compte` |

**Code modifié :**

```tsx
<SheetHeader className="text-left pb-4">
  <div 
    className="flex items-center gap-3 mb-2 cursor-pointer hover:bg-muted/50 rounded-lg p-2 -m-2 transition-colors"
    onClick={() => handleNavigate('/dashboard/compte')}
  >
    <Avatar className="w-12 h-12">
      {manager?.avatar_url ? (
        <AvatarImage src={manager.avatar_url} alt={manager.nom} />
      ) : null}
      <AvatarFallback className="bg-primary/10">
        <User className="h-6 w-6 text-primary" />
      </AvatarFallback>
    </Avatar>
    <div className="flex-1 min-w-0">
      <SheetTitle className="text-base truncate">
        {manager?.nom || "Manager"}
      </SheetTitle>
      {displaySponsor && (
        <p className="text-xs text-muted-foreground truncate">
          {displaySponsor}
        </p>
      )}
      {isAdmin && (
        <p className="text-xs text-secondary font-semibold">
          Administrateur
        </p>
      )}
    </div>
  </div>
</SheetHeader>
```

---

## Résultat visuel

### Avant
```text
┌─────────────────────────────┐
│  [👤]  Alex                 │  ← Pas cliquable, icône fixe
│        BRU                  │
├─────────────────────────────┤
│  Classement                 │
│  Mon Équipe                 │
│  ...                        │
└─────────────────────────────┘
```

### Après
```text
┌─────────────────────────────┐
│  [📷]  Alex              →  │  ← Cliquable → page Mon Compte
│        BRU                  │     Photo si disponible
├─────────────────────────────┤
│  Classement                 │
│  Mon Équipe                 │
│  ...                        │
└─────────────────────────────┘
```

- Clic sur la zone = navigation vers `/dashboard/compte`
- Effet hover pour indiquer que c'est cliquable
- Photo du manager affichée si `avatar_url` existe
- Sinon, icône User en fallback (comme avant)

---

## Résumé des changements

| Fichier | Modification |
|---------|--------------|
| `src/components/mobile/MobileDrawer.tsx` | Import Avatar + zone header cliquable avec photo conditionnelle |

