

## Correction de l'affichage trop large sur mobile

### Probleme identifie

Le composant `TabGroup` conserve `overflow-x-auto` sur son conteneur principal. Cela permet au contenu interne de depasser la largeur de l'ecran, ce qui elargit toute la page. La preview fonctionne car la fenetre contraint la largeur, mais sur un vrai telephone le conteneur deborde.

De plus, dans `PronosticRaceCard`, les badges sur la ligne 1 ont `shrink-0` ce qui les empeche de se reduire, et combinee avec un nom de course long, la ligne depasse la largeur de la carte.

### Modifications prevues

| Fichier | Modification |
|---------|-------------|
| `src/components/mobile/TabGroup.tsx` | Retirer `overflow-x-auto` du conteneur principal pour forcer les onglets a rester dans la largeur disponible |
| `src/components/arena/PronosticRaceCard.tsx` | Retirer `shrink-0` du badge categorie (ligne 110) pour lui permettre de se tronquer si necessaire. Ajouter `truncate` et `max-w-[80px]` sur ce badge pour eviter qu'il depasse |

### Details techniques

1. **TabGroup.tsx ligne 22** : Retirer `overflow-x-auto` de la classe du conteneur. Les onglets avec `flex-1 min-w-0` se repartiront equitablement dans l'espace disponible sans deborder.

2. **PronosticRaceCard.tsx ligne 110** : Le badge categorie passe de `shrink-0` a `shrink truncate max-w-[80px]` pour permettre la troncature quand l'espace manque. Le badge type (ligne 106) garde `shrink-0` car il est plus important.

