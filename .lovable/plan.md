

# Amélioration de l'équilibre visuel des vignettes Résultats

## Problème identifié

Les informations de dates sont trop proéminentes visuellement :
- Icône calendrier qui ajoute du poids visuel
- Texte trop grand (text-sm)
- La flèche "→" ajoute de la longueur

---

## Aperçu visuel

### Avant

```text
┌─────────────────────────────────────────┐
│ Clàssica Comunitat Valencian    [1.1]   │
│ 📅 25 janv. → 25 janv.                  │  ← Trop visible
│ 🏆 Dylan GROENEWEGEN                    │
└─────────────────────────────────────────┘
```

### Après

```text
┌─────────────────────────────────────────┐
│ Clàssica Comunitat Valencian    [1.1]   │
│ 25 janv.                                │  ← Discret, sans icône
│ 🏆 Dylan GROENEWEGEN                    │
└─────────────────────────────────────────┘
```

---

## Modifications

### Fichier : `src/pages/ResultsPage.mobile.tsx`

#### Simplifier l'affichage des dates (lignes 208-216)

Remplacer :
```tsx
subtitle={
  <div className="flex items-center gap-2 text-muted-foreground mt-1">
    <Calendar className="h-4 w-4" />
    <span className="text-sm">
      {format(new Date(race.date_debut), 'd MMM', { locale: dateLocale })}
      {' → '}
      {format(new Date(race.date_fin), 'd MMM', { locale: dateLocale })}
    </span>
  </div>
}
```

Par :
```tsx
subtitle={
  <span className="text-xs text-muted-foreground/70">
    {race.date_debut === race.date_fin 
      ? format(new Date(race.date_debut), 'd MMM', { locale: dateLocale })
      : `${format(new Date(race.date_debut), 'd MMM', { locale: dateLocale })} - ${format(new Date(race.date_fin), 'd MMM', { locale: dateLocale })}`
    }
  </span>
}
```

#### Supprimer l'import Calendar inutilisé (ligne 7)

Retirer `Calendar` de la liste des imports lucide-react.

---

## Changements appliqués

| Élément | Avant | Après |
|---------|-------|-------|
| Icône calendrier | Présente (📅) | Supprimée |
| Taille texte | `text-sm` | `text-xs` |
| Opacité | `text-muted-foreground` | `text-muted-foreground/70` |
| Flèche | `→` | `-` (tiret) |
| Course 1 jour | "25 janv. → 25 janv." | "25 janv." (pas de duplication) |
| Espacement | `mt-1` + `gap-2` | Aucun (inline simple) |

---

## Résultat attendu

Les dates seront plus discrètes et l'attention sera portée sur le nom de la course et le vainqueur, créant un meilleur équilibre visuel.

