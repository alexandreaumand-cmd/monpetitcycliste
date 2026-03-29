

## Double course view on desktop

### Approach

Extract the per-course logic (messages, race situation, stage filter) into a new `LiveCoursePanel` component. On desktop, support selecting up to 2 courses and render 1-2 panels side by side.

### Changes

#### 1. New component `src/components/arena/LiveCoursePanel.tsx`

Encapsulates all per-course state and rendering:
- Hooks: `useArenaMessages`, `useLeagueRosterOwners`, `useMessageReactions`
- Stage filter chips
- Timeline header + messages feed
- Race situation panel (inline right column)

Props: `{ leagueId, courseId, channelId, managerId, toggleReaction }`

#### 2. Update `LiveCourseSelector.tsx`

- Accept new prop `multiSelect?: boolean` and `activeCourseIds?: string[]` / `onSelectMulti?: (ids: string[]) => void`
- When `multiSelect`, allow toggling up to 2 courses (clicking a 3rd deselects the oldest)
- Visual: show selected order (1, 2) on badges when 2 are selected

#### 3. Update `LiveCoursesTab.tsx`

- Desktop: replace `activeCourseId` (single) with `activeCourseIds: string[]` (max 2)
- Pass `multiSelect` to `LiveCourseSelector` on desktop
- Render `activeCourseIds.map(id => <LiveCoursePanel>)` in a flex row, each panel containing its own timeline + situation sub-columns
- Mobile: keep single-select behavior unchanged, continue using single `activeCourseId`

### Desktop layout with 2 courses

```text
┌─ Course Selector (multi) ──────────────────────────────────┐
├─────────────────────────────┬──────────────────────────────-┤
│ COURSE 1                    │ COURSE 2                      │
│ ┌─ Stage filter ──────────┐ │ ┌─ Stage filter ─────────────┐│
│ ├─ Timeline    │ Situation│ │ ├─ Timeline     │ Situation  ││
│ │ messages...  │ groups.. │ │ │ messages...   │ groups..   ││
│ └──────────────┴──────────┘ │ └───────────────┴────────────┘│
└─────────────────────────────┴──────────────────────────────-┘
```

With 1 course selected, layout stays identical to current. With 2, each panel takes 50% width and the situation column narrows to ~280px.

### Files impacted
- `src/components/arena/LiveCoursePanel.tsx` — new component
- `src/components/arena/LiveCourseSelector.tsx` — multi-select support
- `src/components/arena/LiveCoursesTab.tsx` — dual panel orchestration on desktop

