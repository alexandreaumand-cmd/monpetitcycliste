

# Restaurer le style original des coureurs dans l'accordéon

## Objectif

Modifier l'affichage des coureurs dans la version dépliée pour correspondre exactement au style de la capture d'écran.

---

## Comparaison style actuel vs souhaité

| Élément | Actuel | Souhaité |
|---------|--------|----------|
| Fond | `bg-muted/50` avec `rounded` | Aucun fond |
| Padding | `py-1 px-2` | Aucun padding |
| Espacement | `space-y-1.5 pt-2` | Espacement minimal |
| Police | `font-medium` | Police normale `text-sm` |
| Équipe coureur | Affichée à droite | Non affichée |
| Lien "Réduire" | Absent | Non souhaité |
| Alignement | Padding supplémentaire | Aligné avec le texte du manager |

---

## Modification dans `Startlist.mobile.tsx`

### AccordionContent (lignes 664-680)

Remplacer :

```tsx
<AccordionContent>
  <div className="space-y-1.5 pt-2">
    {sortedStarters.map((starter: any) => (
      <div 
        key={starter.coureur_id} 
        className="flex items-center justify-between text-sm py-1 px-2 rounded bg-muted/50"
      >
        <span className="font-medium truncate">{starter.nom}</span>
        {starter.equipe && (
          <span className="text-xs text-muted-foreground truncate ml-2">
            {starter.equipe}
          </span>
        )}
      </div>
    ))}
  </div>
</AccordionContent>
```

Par :

```tsx
<AccordionContent>
  <div className="pt-1">
    {sortedStarters.map((starter: any) => (
      <p key={starter.coureur_id} className="text-sm">
        {starter.nom}
      </p>
    ))}
  </div>
</AccordionContent>
```

---

## Résumé des changements

- Supprimer le fond gris (`bg-muted/50`)
- Supprimer le padding horizontal (`px-2`)
- Supprimer l'espacement excessif (`space-y-1.5`)
- Remplacer `<div>` par `<p>` pour un affichage simple
- Retirer l'affichage de l'équipe du coureur
- Garder uniquement le nom avec `text-sm` (aligné naturellement avec le reste de la vignette)

