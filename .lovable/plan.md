

## Plan : Scroll to top à l'ouverture d'une page de ligue

### Problème
Quand on clique sur une ligue depuis le dashboard, la page cible conserve la position de scroll précédente au lieu de s'afficher depuis le haut.

### Solution
Créer un composant `ScrollToTop` qui écoute les changements de route (`useLocation`) et appelle `window.scrollTo(0, 0)` à chaque navigation.

### Changements

| Fichier | Action |
|---|---|
| `src/components/shared/ScrollToTop.tsx` | Créer : composant avec `useEffect` sur `location.pathname` → `window.scrollTo(0, 0)` |
| `src/App.tsx` | Ajouter `<ScrollToTop />` juste après `<BrowserRouter>` |

