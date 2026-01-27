

# Réduction de la section MAILLOTS et suppression des couleurs

## Problème identifié

D'après la capture d'écran, la section "MAILLOTS" a :
1. Des polices trop grandes par rapport au classement de l'étape
2. Les noms des managers ("Bubu", "Max") sont colorés en bleu/primary

---

## Modifications à apporter

### Fichier : `src/components/courses/CourseResultsDrawer.tsx`

**Lignes 73-93** - Composant `JerseyHoldersBar`

| Élément | Avant | Après |
|---------|-------|-------|
| Emoji maillot | `text-lg w-6` | `text-sm w-5` |
| Nom coureur | `font-medium truncate flex-1` | `font-medium truncate flex-1 text-xs` |
| Équipe | `text-xs text-muted-foreground` | `text-[10px] text-muted-foreground` |
| Manager | `text-xs text-primary font-medium` | `text-[10px] text-muted-foreground` |
| Conteneur ligne | `text-sm` | `text-xs` |
| Padding global | `p-3` | `p-2` |
| Espacement lignes | `space-y-1.5` | `space-y-1` |

### Code modifié

```tsx
return (
  <div className="bg-muted/30 rounded-lg p-2 border space-y-1.5">
    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
      Maillots
    </span>
    <div className="space-y-1">
      {holders.map((holder: any, idx: number) => (
        <div key={idx} className="flex items-center gap-1.5 text-xs">
          <span className="text-sm w-5 flex-shrink-0">{holder.icon}</span>
          <span className="font-medium truncate flex-1">{holder.coureur_nom}</span>
          <span className="text-[10px] text-muted-foreground truncate max-w-[70px]">
            ({holder.equipe})
          </span>
          {holder.manager_nom && (
            <span className="text-[10px] text-muted-foreground flex-shrink-0">
              {holder.manager_nom}
            </span>
          )}
        </div>
      ))}
    </div>
  </div>
);
```

---

## Comparaison visuelle

### Avant
```text
┌────────────────────────────────────────────────┐
│ MAILLOTS                                       │
│ 🟡  Jonathan MILAN      (Lidl - Trek)  Bubu   │  ← Gros, manager coloré
│ 🟢  Jonathan MILAN      (Lidl - Trek)  Bubu   │
│ ⚪  Milan FRETIN        (Cofidis)      Max    │
└────────────────────────────────────────────────┘
```

### Après
```text
┌───────────────────────────────────────────┐
│ MAILLOTS                                  │
│ 🟡 Jonathan MILAN   (Lidl - Trek) Bubu   │  ← Plus compact, manager gris
│ 🟢 Jonathan MILAN   (Lidl - Trek) Bubu   │
│ ⚪ Milan FRETIN     (Cofidis)     Max    │
└───────────────────────────────────────────┘
```

---

## Résumé des changements

| Modification | Détail |
|-------------|--------|
| Taille polices | Réduites de ~20% |
| Couleur manager | `text-primary` → `text-muted-foreground` |
| Padding | `p-3` → `p-2` |
| Espacement | `space-y-1.5` → `space-y-1` + `gap-1.5` |

