
# Correction des contrastes en mode sombre

## Probleme identifie

Les composants UI de base (Button, Badge) et plusieurs composants metier utilisent des couleurs codees en dur (`text-black`, `border-black`, `bg-black`) qui ne s'adaptent pas au mode sombre. Resultat : texte noir invisible sur fond sombre.

Le probleme principal visible sur la capture est le combobox de selection de coureur dont le texte est quasi-invisible en dark mode.

## Fichiers a modifier

### 1. `src/components/ui/button.tsx` -- Composant critique

Remplacer les couleurs codees en dur par des variantes dark-mode-aware :

| Variant | Avant | Apres |
|---------|-------|-------|
| `default` | `text-black` | `text-black` (OK, sur fond jaune) |
| `outline` | `border-2 border-black text-black hover:bg-black` | `border-2 border-foreground text-foreground hover:bg-foreground hover:text-background` |
| `ghost` | `hover:bg-yellow-50 hover:text-black` | `hover:bg-accent hover:text-accent-foreground` |
| `link` | `text-black` | `text-foreground` |

### 2. `src/components/ui/badge.tsx` -- Composant critique

| Variant | Avant | Apres |
|---------|-------|-------|
| `outline` | `border-black` | `border-foreground` |
| `secondary` | `bg-black` | OK (noir avec texte jaune, marche en dark) |

### 3. `src/components/arena/PronosticStartlistCombobox.tsx`

Le composant combobox utilise un bouton `variant="outline"` qui herite du probleme du Button. La correction du Button le corrigera automatiquement. Verifier aussi l'input de recherche interne.

### 4. `src/components/arena/PronosticRaceCard.tsx`

Aucun changement direct necessaire : les couleurs utilisent `text-muted-foreground`, `text-primary`, etc. qui sont deja dark-mode-aware.

### 5. `src/components/dashboard/LeagueCard.tsx`

Plusieurs instances de `text-black` codees en dur dans les badges et boutons inline. Remplacer par `text-foreground` ou garder `text-black` quand sur fond jaune.

### 6. `src/components/mobile/MobileBottomBar.tsx`

Le `text-black` sur fond jaune pour l'etat actif est correct. Le `text-gray-400` pour inactif est OK en dark.

### 7. `src/index.css`

Les classes utilitaires `.btn-tdf` et `.btn-tdf-inverse` utilisent `text-black` -- a corriger quand sur fond non-jaune.

## Regle de correction

- `text-black` sur fond jaune (`bg-[#FFD500]`) : **garder** (le noir sur jaune est toujours lisible)
- `text-black` sur fond generique : **remplacer** par `text-foreground`
- `border-black` decoratif : **remplacer** par `border-foreground` ou `border-border`
- `hover:bg-black` : **remplacer** par `dark:hover:bg-white/10` ou equivalent
- `bg-black` pour secondary : OK (design intentionnel noir/jaune)

## Details techniques

Les modifications sont concentrees sur 3-4 fichiers. Les composants `button.tsx` et `badge.tsx` ont l'impact le plus large car utilises partout. La correction de `LeagueCard.tsx` necessite un audit ligne par ligne pour distinguer les `text-black` sur fond jaune (corrects) des autres.
