

## Problème

L'utilisateur voit **plusieurs écrans successifs** au lancement de la PWA :

1. **Écran blanc HTML** — le `<body>` est vide jusqu'à ce que React se monte
2. **Suspense `<LoadingSpinner />`** — pendant le lazy-load de Index/Dashboard
3. **Index `<LoadingSpinner />`** — pendant la vérification de session
4. **Dashboard `<LoadingSpinner />`** — pendant le chargement manager/rôle

Même si les écrans 2-4 utilisent le même composant, l'écran 1 (HTML pur avant React) crée un flash blanc. Et chaque remontage du composant `LoadingSpinner` réinitialise la citation avec une animation, créant des "sauts" visuels.

De plus, l'utilisateur demande : **une seule citation aléatoire par chargement**, sans alternance.

## Plan

### 1. Splash screen HTML natif dans `index.html`

Ajouter un écran de chargement **directement dans le HTML** (avant React) dans le `<div id="root">` :
- Fond beige `#F5F0E8` sur le `<body>` et dans le div
- Le nouveau logo (avec texte "La Bordure Fantasy Cycling") centré
- Un spinner gold CSS
- Une citation aléatoire générée en JS inline (pick parmi une liste courte)

Cet écran est **immédiatement visible** dès l'ouverture, avant même que React ne charge. React le remplacera naturellement en montant dans `#root`.

### 2. Mettre à jour le logo

Copier `Logo_carré_500x500.png` dans `src/assets/logo-carre-sans-marque.png` **et** dans `public/splash-logo.png` (pour l'accès HTML direct).

### 3. Simplifier `LoadingSpinner`

- Supprimer le `setInterval` / alternance de citations
- Utiliser `useState(getRandomQuote)` sans `useEffect` — une seule citation fixe par montage
- Utiliser le nouveau logo
- Garder le même fond beige `#F5F0E8`, spinner gold, même mise en page que le HTML

### 4. `body` background

Dans `index.html`, ajouter `style="background:#F5F0E8"` sur `<body>` pour que même le tout premier pixel affiché soit beige.

### Fichiers modifiés

| Fichier | Modification |
|---|---|
| `public/splash-logo.png` | Nouveau logo (copie pour accès HTML) |
| `src/assets/logo-carre-sans-marque.png` | Nouveau logo avec texte |
| `index.html` | Body beige + splash HTML inline dans `#root` avec logo, spinner, citation JS |
| `src/components/shared/LoadingSpinner.tsx` | Supprimer l'alternance, une seule citation fixe, nouveau logo |

### Résultat

Du clic PWA → app chargée : **un seul écran visuel continu** (beige + logo + citation fixe), sans flash ni transition.

