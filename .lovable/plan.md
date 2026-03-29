

## Réorganisation mobile de la page Live : Situation en haut + Timeline en accordéon

### Changements dans `src/components/arena/LiveCoursesTab.tsx`

**1. Réorganiser l'ordre mobile** : sur mobile (`lg:hidden`), afficher la section "Situation de course" **avant** la timeline des messages. Utiliser `order-first lg:order-none` sur le bloc situation mobile, ou restructurer le JSX avec un wrapper conditionnel.

**2. Situation de course ouverte par défaut** : le `Collapsible` mobile doit avoir `defaultOpen={true}`.

**3. Envelopper la timeline dans un accordéon mobile** : ajouter un second `Collapsible` autour du bloc messages sur mobile, avec :
- Titre "Timeline" + icône `MessageCircle`
- `defaultOpen={true}`
- Le contenu reste le feed de messages existant

**4. Inverser l'ordre des messages** : afficher le dernier message posté **en haut** (reverse chronologique). Appliquer `.slice().reverse()` sur `filteredMessages` dans le rendu mobile, et supprimer l'auto-scroll vers le bas.

### Structure mobile résultante

```text
┌─ Course Selector ──────────────┐
├─ Stage filter chips (si >1)    │
├─ ▼ SITUATION DE COURSE (ouvert)│
│   [RaceSituationDisplay]       │
├─ ▼ TIMELINE (ouvert)           │
│   Message le plus récent       │
│   Message précédent            │
│   ...                          │
└────────────────────────────────┘
```

### Fichier impacté
- `src/components/arena/LiveCoursesTab.tsx`

