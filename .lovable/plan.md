

## Correction de la largeur d'ecran sur mobile

### Probleme

Les onglets et sous-onglets poussent la largeur de la page au-dela de l'ecran mobile. Le contenu en dessous ne s'adapte pas car rien ne contraint la largeur maximale. Le `TabGroup` utilise `overflow-x-auto` ce qui permet au contenu de deborder, et le conteneur principal (`<main>`) n'a aucune contrainte de largeur.

### Solution

Appliquer des contraintes de largeur a plusieurs niveaux :

| Fichier | Modification |
|---------|-------------|
| `src/components/mobile/MobileLayout.tsx` | Ajouter `overflow-x-hidden` sur le `<main>` (ligne 73) pour empecher tout debordement horizontal |
| `src/pages/ArenaPage.tsx` | Ajouter `overflow-hidden` sur le conteneur principal (ligne 39) |
| `src/components/arena/PronosticRaceCard.tsx` | Ajouter `overflow-hidden` sur le `CardContent` et `min-w-0` sur le conteneur flex de la ligne 1 pour permettre la troncature correcte des elements |

### Details techniques

1. **MobileLayout.tsx ligne 73** : `<main className="pb-safe">` devient `<main className="pb-safe overflow-x-hidden">` -- cela empeche globalement tout contenu de deborder horizontalement sur mobile.

2. **ArenaPage.tsx ligne 39** : `<div className="space-y-0 pt-2">` devient `<div className="space-y-0 pt-2 overflow-hidden">` -- securite supplementaire au niveau de la page.

3. **PronosticRaceCard.tsx ligne 102** : `<div className="flex items-center gap-2">` devient `<div className="flex items-center gap-1.5 min-w-0 overflow-hidden">` -- le `min-w-0` permet au flex de se reduire correctement, et `overflow-hidden` coupe proprement les elements qui debordent. Reduction du gap pour gagner de la place.

