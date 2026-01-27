
# Ajout de l'avatar du manager

## Objectif

Afficher discrètement la photo de profil du manager dans 3 endroits :
1. **Fun Awards (KPIs)** - A côté du nom du gagnant
2. **Sheet "Détail Manager"** - Dans le header du panneau latéral
3. **Vue Comparaison** - A côté des noms des managers sélectionnés

---

## Aperçu visuel

### 1. Fun Awards (RankingsKPIs)

```text
┌─────────────────────────────────┐
│ 😂                              │
│ Manager le plus drôle           │
│                                 │
│ ┌───────────────────────────┐   │
│ │ [👤] Jean-Pierre Martin   │   │
│ └───────────────────────────┘   │
└─────────────────────────────────┘
```
Avatar 24px a gauche du nom, dans le bandeau jaune.

### 2. Sheet "Détail Manager" (ManagerBreakdown)

```text
┌─────────────────────────────────────────────┐
│ [👤 32px] Détail de Jean-Pierre    125 pts  │
├─────────────────────────────────────────────┤
│ (contenu existant...)                       │
└─────────────────────────────────────────────┘
```
Avatar 32px avant le titre dans le CardHeader.

### 3. Vue Comparaison (ManagerComparison)

```text
┌──────────────────┬──────────────────┐
│ Manager A        │ Manager B        │
│ [👤] Jean-Pierre │ [👤] Marie       │
└──────────────────┴──────────────────┘
```
Avatar 24px a cote des selecteurs et dans les metriques.

---

## Modifications techniques

### 1. RankingsKPIs.tsx

**Requete** (ligne 61-66) - Ajouter `avatar_url` a la jointure :
```tsx
.select(`
  id,
  award_type,
  manager_id,
  managers!manager_fun_awards_manager_id_fkey(nom, avatar_url)
`)
```

**Affichage** (lignes 221-226 et 263-268) - Ajouter Avatar :
```tsx
<div className="bg-white dark:bg-gray-800 rounded-lg p-3 border-2 border-[#FFD500] shadow-md">
  <div className="flex items-center justify-center gap-2">
    <Avatar className="h-6 w-6">
      <AvatarImage src={award.avatarUrl} alt={award.managerName} />
      <AvatarFallback className="text-xs">{award.managerName[0]}</AvatarFallback>
    </Avatar>
    <p className="text-xl font-bold">{award.managerName}</p>
  </div>
</div>
```

**Imports** - Ajouter :
```tsx
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
```

---

### 2. ManagerBreakdown.tsx

**Nouvelle requete** - Fetcher l'avatar du manager :
```tsx
const { data: managerInfo } = useQuery({
  queryKey: ["manager-info", managerId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("managers")
      .select("nom, avatar_url")
      .eq("id", managerId)
      .single();
    if (error) throw error;
    return data;
  },
  enabled: !!managerId,
});
```

**Header** (lignes 232-235) - Ajouter Avatar avant le titre :
```tsx
<CardTitle className="flex items-center gap-3">
  <Avatar className="h-8 w-8">
    <AvatarImage src={managerInfo?.avatar_url} alt={managerName} />
    <AvatarFallback>{managerName.substring(0, 2).toUpperCase()}</AvatarFallback>
  </Avatar>
  {t('breakdown.details', { name: managerName })}
</CardTitle>
```

**Imports** - Ajouter :
```tsx
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
```

---

### 3. ManagerComparison.tsx

**Requete** (lignes 28-43) - Ajouter `avatar_url` :
```tsx
const { data, error } = await supabase
  .from("managers")
  .select("id, nom, avatar_url")
  .in("id", ids);
```

**Header des selecteurs** (lignes 836-853) - Ajouter Avatar sous chaque selecteur :
```tsx
<div>
  <label className="text-sm font-medium mb-2 block">Manager A</label>
  <ManagerSelect ... />
  {managerA && (
    <div className="flex items-center gap-2 mt-2">
      <Avatar className="h-6 w-6">
        <AvatarImage src={managerAAvatar} alt={managerAName} />
        <AvatarFallback>{managerAName[0]}</AvatarFallback>
      </Avatar>
      <span className="text-sm font-medium">{managerAName}</span>
    </div>
  )}
</div>
```

**Variables derivees** (apres ligne 820) :
```tsx
const managerAAvatar = selectedManagers?.find(m => m.id === managerA)?.avatar_url;
const managerBAvatar = selectedManagers?.find(m => m.id === managerB)?.avatar_url;
```

**Imports** - Ajouter :
```tsx
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
```

---

## Resume des fichiers

| Fichier | Modifications |
|---------|---------------|
| `src/components/rankings/RankingsKPIs.tsx` | Ajouter avatar_url a la requete, afficher Avatar 24px a cote du nom |
| `src/components/rankings/ManagerBreakdown.tsx` | Nouvelle requete manager, Avatar 32px dans le header |
| `src/components/rankings/ManagerComparison.tsx` | Ajouter avatar_url a la requete, Avatar 24px sous les selecteurs |

---

## Composant UI

Le projet dispose deja du composant `Avatar` de Radix UI (`@radix-ui/react-avatar`) avec `AvatarImage` et `AvatarFallback` pour gerer les cas sans photo.
