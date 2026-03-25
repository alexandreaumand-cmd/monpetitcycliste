

## Add Detail View to Knowledge Ranking

### What changes

**1. Edge Function: `supabase/functions/get-knowledge-ranking/index.ts`**

- Add pagination (same pattern as other functions) to avoid the 1000-row limit on `points_ledger`
- Fetch rider names by joining `coureurs` table for each manager's roster
- Return a `riders` array per manager containing: `{ nom, prix_signature, points, ratio, is_pepite }`
- Sort riders by ratio descending so pépites appear prominently

**2. Component: `src/components/rankings/BikeKnowledgeRanking.tsx`**

- Make each manager row clickable/expandable (toggle state with `useState`)
- On expand, show a table/list of the manager's riders with columns: Rider name, Price, Points, Ratio, Pépite badge
- Highlight pépites with a gem icon and distinct styling (e.g., gold/green badge)
- On mobile: collapsible card with compact rider rows
- Use ChevronDown/ChevronUp icon to indicate expandability

### Data structure returned per manager

```typescript
{
  manager_id, manager_nom, rank, knowledge_score,
  avg_ratio, pepites_count, wt_percentage,
  riders: [
    { nom: "Rider Name", prix_signature: 15, points: 120, ratio: 8.0, is_pepite: true },
    ...
  ]
}
```

### Pépite criteria (unchanged)
Price ≤ 20 AND ratio > 2.5

