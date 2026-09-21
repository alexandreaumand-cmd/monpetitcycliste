import React from "react";

const RELOAD_FLAG = "lk:chunk-reloaded-at";

/**
 * Wraps React.lazy so that a failed dynamic import (typically caused by a new
 * deployment replacing the previous JS chunks while an old page is still cached
 * on the device) retries once, then reloads the page a single time to fetch the
 * freshest version instead of showing an error screen.
 */
export function lazyWithRetry<T extends React.ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      // Second chance: transient network hiccup.
      try {
        await new Promise((resolve) => setTimeout(resolve, 400));
        return await factory();
      } catch (retryError) {
        const lastReload = Number(
          window.sessionStorage?.getItem(RELOAD_FLAG) ?? 0,
        );
        const now = Date.now();

        // Reload at most once per 30s to avoid any reload loop.
        if (!lastReload || now - lastReload > 30_000) {
          try {
            window.sessionStorage?.setItem(RELOAD_FLAG, String(now));
          } catch {
            /* storage unavailable: still attempt the reload */
          }
          window.location.reload();
          // Never resolves: the page is navigating away.
          return await new Promise<{ default: T }>(() => {});
        }

        throw retryError ?? error;
      }
    }
  });
}
