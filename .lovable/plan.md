

## Corriger l'extraction des coureurs dans la situation de course L'Équipe

### Problème
Le scraper détecte correctement les 4 groupes (Van der Poel, Dewulf, Gr. Morgado, Peloton) mais affiche **0 coureurs** dans chaque groupe. La cause est à la ligne 300 du scraper :

```typescript
const detailCut = section.search(/masquer le d[ée]tail|afficher le d[ée]tail/i);
if (detailCut > 0) section = section.substring(0, detailCut);
```

Ce code **coupe la section AVANT** "afficher le détail des écarts", mais sur L'Équipe, la liste détaillée des coureurs se trouve **après** ce texte (dans le HTML statique, le contenu détaillé est présent mais masqué par CSS — le `textContent` les contient tous). Résultat : le pattern d'extraction des coureurs (ligne 304) s'applique sur une section vide.

### Solution

**`supabase/functions/scrape-live-race/index.ts`** — 2 modifications :

#### 1. Inverser la logique du `detailCut`
Au lieu de couper au "afficher le détail", chercher les coureurs dans la **totalité** de la section. Supprimer le `detailCut` ou le changer pour couper uniquement à "masquer le détail" (qui indique la fin de la vue détaillée) :

```typescript
// Supprimer les lignes 299-301
// Ou les remplacer par : ne couper qu'au "masquer" (fin de la liste expanded)
const detailCut = section.search(/masquer le d[ée]tail/i);
if (detailCut > 0) section = section.substring(0, detailCut);
```

#### 2. Améliorer le riderPattern pour gérer les flags emoji
L'Équipe préfixe chaque coureur d'un drapeau emoji (🇳🇱, 🇫🇷, etc.) qui peut interférer avec la regex. Le pattern actuel (ligne 304) attend que le nom commence par `[A-ZÀ-Ü]`, mais le flag emoji est avant. Ajouter un skip optionnel pour les emojis/flags :

```typescript
const riderPattern = /(?:[\u{1F1E0}-\u{1F1FF}]{2}\s*)?([A-ZÀ-Ü][a-zà-ü]*\.?\s+[A-Za-zÀ-ü\- ']+?)\s*\(([^)]+)\)/gu;
```

### Fichier impacté
- `supabase/functions/scrape-live-race/index.ts` — lignes 299-304

