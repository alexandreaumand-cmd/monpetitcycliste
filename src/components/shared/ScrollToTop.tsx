import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Smart scroll restoration for SPA navigation:
 * - On PUSH/REPLACE (forward navigation), scroll to top — fresh page, fresh view.
 * - On POP (browser back/forward), restore the saved scroll position so the user
 *   doesn't lose their place in long lists (auctions, results, rankings…).
 *
 * Scroll positions are kept in-memory (per-pathname) for the lifetime of the tab,
 * which is enough for the typical "back" use case without bloating sessionStorage.
 */
const scrollPositions = new Map<string, number>();

export const ScrollToTop = () => {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const previousPathname = useRef<string | null>(null);

  // Save scroll position of the page we're leaving.
  useEffect(() => {
    return () => {
      if (previousPathname.current !== null) {
        scrollPositions.set(previousPathname.current, window.scrollY);
      }
    };
    // We re-register on every pathname change so the cleanup captures the
    // *previous* pathname's scroll right before unmount/transition.
  }, [pathname]);

  useEffect(() => {
    // Track the pathname currently mounted so the cleanup above can save it.
    previousPathname.current = pathname;

    if (navigationType === "POP") {
      // Browser back/forward — restore previous scroll if we have it.
      const saved = scrollPositions.get(pathname);
      if (typeof saved === "number") {
        // Defer to next frame so the new content is laid out first.
        requestAnimationFrame(() => window.scrollTo(0, saved));
        return;
      }
    }
    // Forward navigation: behave like a fresh page.
    window.scrollTo(0, 0);
  }, [pathname, navigationType]);

  return null;
};
