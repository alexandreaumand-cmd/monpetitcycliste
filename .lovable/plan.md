

## Fix auto-scrape qui ne fonctionne pas (Live Broadcast)

### Probleme identifie
Le `setInterval` de l'auto-scrape capture une **closure perimee** de `handleScrape` et `isScraping` car :
1. `handleScrape` n'est pas dans le tableau de dependances du `useEffect`
2. `handleScrape` n'est pas memoize (`useCallback`) — il est recree a chaque render
3. `isScraping` dans la closure du `doAutoScrape` reste figee a la valeur au moment de la creation de l'intervalle

Resultat : l'intervalle tourne mais appelle une version perimee de `handleScrape`, ou `isScraping` reste `true` dans la closure, bloquant chaque execution.

Les logs de production confirment : **0 appel** a `scrape-live-race` — le scrape ne se declenche jamais.

### Solution — `src/pages/admin/SuperAdminLiveBroadcastPage.tsx`

1. **Utiliser des refs** pour `isScraping` et `handleScrape` afin d'eviter les problemes de closure :

```typescript
const isScrapingRef = useRef(false);
const handleScrapeRef = useRef(handleScrape);

// Garder la ref a jour
useEffect(() => {
  handleScrapeRef.current = handleScrape;
});
```

2. **Mettre a jour `handleScrape`** pour synchroniser `isScrapingRef` avec `isScraping` :

```typescript
const handleScrape = async (isAuto = false) => {
  if (!scrapeUrl || !activeCourseId) return;
  if (isScrapingRef.current) return; // Guard via ref
  setIsScraping(true);
  isScrapingRef.current = true;
  // ... existing logic ...
  finally {
    setIsScraping(false);
    isScrapingRef.current = false;
    setLastAutoScrapeAt(new Date());
  }
};
```

3. **Corriger le `useEffect` de l'intervalle** pour utiliser les refs :

```typescript
useEffect(() => {
  if (autoScrapeRef.current) {
    clearInterval(autoScrapeRef.current);
    autoScrapeRef.current = null;
  }
  if (!autoScrapeEnabled || !scrapeUrl || !activeCourseId) return;

  const doAutoScrape = () => {
    if (isScrapingRef.current) return;
    handleScrapeRef.current(true);
  };

  // Fire immediately on enable, then every 60s
  doAutoScrape();
  autoScrapeRef.current = setInterval(doAutoScrape, 60_000);
  return () => {
    if (autoScrapeRef.current) clearInterval(autoScrapeRef.current);
  };
}, [autoScrapeEnabled, scrapeUrl, activeCourseId]);
```

4. **Bonus** : declencher immediatement un premier scrape quand on active l'auto-scrape (au lieu d'attendre 60s).

### Fichier impacte
- `src/pages/admin/SuperAdminLiveBroadcastPage.tsx` uniquement

