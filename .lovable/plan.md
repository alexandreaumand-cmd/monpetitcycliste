

## Ajouter un titre séparé aux événements de la timeline (style L'Équipe)

### Problème
L'Équipe affiche chaque événement avec un **titre en gras** puis un texte descriptif en dessous. Actuellement, le scraper fusionne tout dans un seul champ `text`, et l'affichage (superadmin + ligues) montre un bloc de texte uniforme sans distinction titre/corps.

### Solution

#### 1. Scraper — Extraire le titre séparé
**`supabase/functions/scrape-live-race/index.ts`** (section timeline ~ligne 325-369)

Dans le texte capturé par événement, la première phrase (avant le premier `.` suivi d'un espace et d'une majuscule, ou avant un retour à la ligne) correspond au titre L'Équipe. Séparer :

```typescript
// Après nettoyage du text brut
let title = "";
let body = text;
const splitMatch = text.match(/^([^.]{10,120}\.)\s+([A-ZÀ-Ü])/);
if (splitMatch) {
  title = splitMatch[1];
  body = text.substring(splitMatch[1].length).trim();
} else if (text.length > 80) {
  // Fallback: première phrase courte
  const dotIdx = text.indexOf('.');
  if (dotIdx > 10 && dotIdx < 120) {
    title = text.substring(0, dotIdx + 1);
    body = text.substring(dotIdx + 1).trim();
  }
}

events.push({ time: timeStr, type, title, text: body, riders: riderNames });
```

#### 2. Interface TypeScript — Ajouter `title`
**`src/components/arena/RaceTimeline.tsx`** — Ajouter `title?: string` à `TimelineEvent`

#### 3. Affichage SuperAdmin — Titre en gras
**`src/components/arena/RaceTimeline.tsx`** — Dans le rendu de chaque événement (ligne 93), afficher le titre en gras au-dessus du body :

```tsx
{event.title && (
  <p className="text-xs font-semibold leading-snug">{event.title}</p>
)}
<p className="text-xs leading-relaxed text-muted-foreground">{event.text}</p>
```

#### 4. Broadcast vers les ligues — Inclure le titre
**`src/pages/admin/SuperAdminLiveBroadcastPage.tsx`** (ligne 352) — Modifier le format du broadcast pour inclure le titre en gras :

```typescript
// Avant: `${typeEmoji} **${evt.time}** — ${enrichText(evt.text)}`
// Après:
const titlePart = evt.title ? `**${enrichText(evt.title)}**\n` : "";
const content = `${typeEmoji} ${evt.time} — ${titlePart}${enrichText(evt.text)}`;
```

#### 5. Affichage côté ligue — Rendre le markdown bold
**`src/components/arena/MessageBubble.tsx`** — Le contenu utilise déjà `**text**` pour le gras (via le split regex existant ligne 60). Vérifier que le pattern `**...**` est rendu en `<strong>`. Si ce n'est pas le cas, ajouter la détection du pattern `**text**` dans le rendu.

### Fichiers impactés
- `supabase/functions/scrape-live-race/index.ts` — extraction titre/body
- `src/components/arena/RaceTimeline.tsx` — interface + affichage titre
- `src/pages/admin/SuperAdminLiveBroadcastPage.tsx` — format broadcast
- `src/components/arena/MessageBubble.tsx` — rendu markdown (vérification)

