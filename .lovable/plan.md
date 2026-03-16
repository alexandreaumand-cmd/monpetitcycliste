

## Plan: Cycling quotes during loading screens

### What
Add random cycling quotes that rotate below the logo on all loading screens (LoadingSpinner component and Index.tsx loading state).

### Implementation

**1. Create a cycling quotes utility** (`src/lib/cycling-quotes.ts`)
- Array of ~15-20 famous cycling quotes in French (e.g., "La souffrance est temporaire, la fierté est éternelle", "Il n'y a pas de raccourcis vers le sommet", quotes from Merckx, Hinault, Anquetil, etc.)
- Each quote has `text` and `author` fields
- Export a `getRandomQuote()` helper

**2. Update `LoadingSpinner.tsx`**
- Use `useState` to pick a random quote on mount
- Use `useEffect` with `setInterval` (~4s) to rotate quotes with a fade transition
- Display quote text + author below the spinner
- Style: italic, muted text color, max-width constrained, fade-in animation

**3. Update `Index.tsx` loading state**
- Same pattern: random quote below the spinner on the green background
- Adapted text color (light/gold) for the dark background

### Quotes examples
- "La douleur est temporaire, l'abandon est définitif." — Lance Armstrong (or anonymous)
- "Le vélo ne ment jamais." — Greg LeMond
- "Il faut souffrir pour être beau... au classement." — Bernard Hinault
- "La course, c'est la vie condensée." — Eddy Merckx

