

## Plan : Clic sur l'image du parcours pour l'afficher en grand

### Problème
L'image du parcours dans la vue startlist desktop est affichée en petit dans le composant `StartlistDesktopExport`, mais aucun gestionnaire de clic ne permet d'ouvrir le modal d'agrandissement qui existe déjà dans `Startlist.desktop.tsx`.

### Solution

**Fichier 1 : `src/components/startlist/StartlistDesktopExport.tsx`**
- Ajouter une prop optionnelle `onRouteImageClick?: () => void` à l'interface
- Sur l'image du parcours (ligne 118-122), ajouter `onClick={onRouteImageClick}` et la classe `cursor-zoom-in` pour indiquer visuellement que l'image est cliquable

**Fichier 2 : `src/pages/Startlist.desktop.tsx`**
- Passer la prop `onRouteImageClick={() => setIsImageModalOpen(true)}` au composant `StartlistDesktopExport` (ligne 373-376)

### Résultat
Un clic sur la miniature du parcours ouvrira le modal plein écran qui existe déjà, affichant l'image en grand format.

