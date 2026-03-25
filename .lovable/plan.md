

## Problem

The auction header on mobile (`AuctionHeaderMobile.tsx`) displays a logo and a "Phase X" badge that take up too much vertical space, reducing the area available for the actual auction content.

## Solution

Remove the logo header block (lines 93-106) that contains the La Bordure logo and the "Phase X" badge. The league context is already visible in the main app header, so this is redundant.

### File to modify

**`src/components/auction/v2/AuctionHeaderMobile.tsx`**
- Remove the entire logo/phase block (lines 93-106): the `<div>` containing the logo `<Link>` and the `Phase {phase_index}` badge
- Remove the unused `mpcLogo` import (line 8) and the `Link` import (line 7) since they won't be needed anymore
- The `phase_index` prop can also be removed from the interface and destructuring since it's no longer used

