

## Carte pronostic : 2 lignes

### Disposition

```text
Ligne 1 : [Nom course (truncate)]  [Badge type]  [Badge categorie]  [Horloge jaune + temps compact]  [Icone statut]
Ligne 2 : [Selecteur coureur pleine largeur]  (uniquement si non expire, sinon resultat ou "aucun choix")
```

### Modifications

**Fichier : `src/components/arena/PronosticRaceCard.tsx`**

- Fusionner la ligne deadline dans la ligne 1 : ajouter l'horloge jaune + temps compact a droite, avant l'icone statut
- Ajouter une fonction `formatShortDeadline(deadlineDate, lang)` pour le format compact :
  - Moins de 1h : `45min`
  - Entre 1h et 24h : `2h12`
  - Entre 1 et 7 jours : `2jrs` (fr) / `2d` (en)
  - Plus de 7 jours : `3sem` (fr) / `3w` (en)
- Supprimer la ligne 2 actuelle (deadline separee)
- Ligne 2 : uniquement le selecteur coureur en `w-full` si non expire, ou le resultat/texte "aucun choix" si expire
- Supprimer l'ancien `deadlineText` base sur `formatDistanceToNow`

