

## Fix : le coureur en tête (Van der Poel) n'apparaît pas dans la situation de course

### Cause racine

Le `situationZone` est construit à partir de la première occurrence d'un mot-clé de groupe (`Gr.`, `Peloton`, `Échappée`...) trouvée après "km/h" (ligne 197). Or "Van der Poel" n'est pas un mot-clé — c'est un nom de coureur **sans écart** (leader). Le `zoneStart` saute directement à "Gr. Vermeersch", excluant tout ce qui précède, y compris le nom du leader.

Pass 4 cherche le leader dans `beforeFirst` (avant le premier groupe dans la zone), mais cette zone est soit vide, soit pleine de JSON-LD/commentaires car le découpage était trop tardif.

### Solution

**Fichier : `supabase/functions/scrape-live-race/index.ts`** — 2 modifications :

#### 1. Élargir la zone de situation pour inclure le texte avant le premier groupe
Ligne 197 : ajouter la détection de noms propres suivis de rien (le leader) comme indicateur de début de zone. Concrètement, reculer le `zoneStart` de ~200 caractères avant le premier mot-clé de groupe pour capturer le nom du leader qui le précède :

```typescript
const groupIndicator = afterKmh.search(/(?:Échapp[ée]e|Peloton|Gr\.\s|Groupe\s+de|Poursuivants?|Favoris|T[eê]te\s+de\s+course)/i);
// Back up to capture potential leader name before the first group keyword
const zoneStart = groupIndicator >= 0 
  ? kmhIdx + Math.max(0, groupIndicator - 200) 
  : kmhIdx;
```

#### 2. Améliorer Pass 4 pour mieux détecter le leader
Actuellement le `beforeFirst` peut contenir du texte parasite. Renforcer la détection en cherchant spécifiquement un pattern L'Équipe : le nom du leader apparaît **seul sur une ligne logique**, souvent juste avant "Gr." ou "Peloton", sans gap. Scanner les ~300 derniers caractères avant le premier groupe détecté :

```typescript
// Pass 4: improved — search specifically in the 300 chars before the first group
if (uniqueHeaders.length > 0 && !uniqueHeaders.some(h => h.gap === "0:00")) {
  const firstGroupIdx = uniqueHeaders[0].index;
  const searchStart = Math.max(0, firstGroupIdx - 300);
  const beforeFirst = situationZone.substring(searchStart, firstGroupIdx).trim();
  
  // Look for a standalone name pattern (possibly with flag emoji)
  const leaderRx = /(?:[\u{1F1E0}-\u{1F1FF}]{2}\s*)?([A-ZÀ-Ü][a-zà-ü]*\.?\s+(?:(?:de|van|von|el|di|du|le|la|ter|den|der|dos|da)\s+)*[A-ZÀ-Ü][a-zà-ü'-]+(?:\s+[A-Za-zÀ-ü'-]+)*)/iu;
  // ... rest of validation unchanged
}
```

### Fichier impacté
- `supabase/functions/scrape-live-race/index.ts` — élargissement zone + amélioration Pass 4

