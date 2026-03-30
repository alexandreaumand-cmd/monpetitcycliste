

## Fix: League not visible after joining

### Root cause
In `JoinLeagueDialog.tsx`, after a successful join (both by code and by clicking), only `refetch()` on the `user-leagues` query key is called. The `LeagueContext` uses a separate query key (`user-leagues-for-context`) with a 5-minute stale time that is never invalidated. This means the context may still think the user has no leagues, and the dashboard may render stale data.

### Fix — `src/components/leagues/JoinLeagueDialog.tsx`

1. Import `useQueryClient` from `@tanstack/react-query`
2. After `await refetch()`, also invalidate `user-leagues-for-context`:
   ```ts
   await refetch();
   queryClient.invalidateQueries({ queryKey: ['user-leagues-for-context'] });
   ```
3. Apply this in both `handleJoinLeague` (public league join) and `handleJoinByCode` (invite code join)

### Also fix — `src/pages/JoinLeaguePage.tsx`

The `/join?token=...` page flow does NOT invalidate any queries at all before redirecting. Add query invalidation for both keys before the redirect timeout:
```ts
queryClient.invalidateQueries({ queryKey: ['user-leagues'] });
queryClient.invalidateQueries({ queryKey: ['user-leagues-for-context'] });
```

### Summary
- 2 files modified
- Both join paths (dialog + URL) will now properly refresh the leagues cache so the dashboard shows the newly joined league immediately

