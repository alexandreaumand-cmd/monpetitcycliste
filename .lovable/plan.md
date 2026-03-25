

## Problem

The Statistics page ("Statistiques") is accessible from the desktop sidebar but is missing from the mobile navigation drawer (`MobileDrawer.tsx`). The mobile drawer defines its nav items as hardcoded arrays and the Statistics entry was never added.

## Plan

**File: `src/components/mobile/MobileDrawer.tsx`**

Add the Statistics entry to the "Courses" section (logical grouping with results and race data):

```typescript
{
  title: "Courses",
  items: [
    { label: "Courses", path: "/dashboard/courses", icon: Calendar },
    { label: "Résultats", path: "/dashboard/resultats", icon: BarChart3 },
    { label: "Statistiques", path: "/dashboard/statistiques", icon: LineChart },
  ],
},
```

Also add the `LineChart` import from `lucide-react` (already used in the desktop sidebar).

This is a single-line addition -- no other files need changes since the route and page already exist.

