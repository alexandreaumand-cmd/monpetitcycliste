

## Problem

The dashboard league cards use `useLeagueCardsData.ts` to determine auction status. On line 274-276, open auctions are filtered by `activePhaseId`, which is determined by today's calendar date (Phase 1: Jan 1 – Mar 21). Since today falls within Phase 1, the open Round 1 of Phase 2 is filtered out and never displayed on the card.

This is the exact same bug that was fixed in `useLeagueAuctionStatus.tsx` but the fix was not applied to the batch data hook used by the dashboard.

## Fix

**File: `src/hooks/useLeagueCardsData.ts`** (lines 270-325)

Modify the auction matching logic to prioritize any open auction across all phases first, then fall back to calendar-based phase filtering for closed/scheduled auctions:

```
// Current (broken):
const openAuction = leagueAuctions.find(
  a => a.statut === 'open' && (!activePhaseId || a.phase_id === activePhaseId)
);

// Fixed:
const openAuction = leagueAuctions.find(a => a.statut === 'open');
```

Same change for closed-with-pending and scheduled: keep phase filtering only as a secondary preference, not a hard filter. Specifically:
1. **Open auctions**: Search all phases (remove phase filter entirely)
2. **Closed with pending announcements**: Try active phase first, then fall back to any phase
3. **Scheduled**: Try active phase first, then fall back to any phase

This mirrors the fix already applied to `useLeagueAuctionStatus.tsx`.

