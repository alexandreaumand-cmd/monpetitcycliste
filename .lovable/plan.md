

# Plan: Promouvoir Live Courses en onglet principal de l'Arène

## Problème
Le canal "Live Courses" est actuellement enfoui dans le sous-menu du TrashTalk (via le ChannelSelector). Il faut 2 clics pour y accéder. C'est une fonctionnalité importante qui mérite son propre onglet.

## Solution
Passer de 4 à 5 onglets dans l'Arène en extrayant la logique live-courses du TrashTalkTab dans un composant dédié.

```text
Avant:  Pronostics | Votes | TrashTalk (→ general / live-courses) | Hall of Fame
Après:  Pronostics | Votes | TrashTalk | Live 🔴 | Hall of Fame
```

## Modifications

### 1. Créer `src/components/arena/LiveCoursesTab.tsx`
- Extraire toute la logique live-courses de TrashTalkTab (channel = "live-courses", LiveCourseSelector, broadcast mode, messages read-only sauf super-admin)
- Composant autonome qui prend `leagueId` en prop
- Réutilise les mêmes hooks (useArenaMessages, useArenaRealtime, etc.) avec le channelId du canal "live-courses"

### 2. Simplifier `TrashTalkTab.tsx`
- Retirer le ChannelSelector, le LiveCourseSelector, et toute la logique conditionnelle `activeSlug === "live-courses"`
- Le TrashTalkTab ne gère plus que le canal "general" (trash talk classique)
- Supprimer les imports inutilisés (Radio, LiveCourseSelector, ChannelSelector, etc.)

### 3. Modifier `ArenaPage.tsx`
- Ajouter un 5e onglet "live" avec l'icône Radio
- `grid-cols-4` → `grid-cols-5`
- Ajouter `"live"` dans VALID_TABS
- Rendre le TabsContent pour LiveCoursesTab

### 4. Mettre à jour les traductions (fr + en)
- Ajouter `tabs.live` : "Live" (fr) / "Live" (en)

### 5. Supprimer `ChannelSelector.tsx`
- Plus utilisé nulle part après la séparation

## Fichiers impactés

| Fichier | Action |
|---|---|
| `src/components/arena/LiveCoursesTab.tsx` | Créer |
| `src/components/arena/TrashTalkTab.tsx` | Simplifier (retirer live-courses) |
| `src/pages/ArenaPage.tsx` | Ajouter 5e onglet |
| `src/components/arena/ChannelSelector.tsx` | Supprimer |
| `src/i18n/locales/fr/arena.json` | Ajouter `tabs.live` |
| `src/i18n/locales/en/arena.json` | Ajouter `tabs.live` |

