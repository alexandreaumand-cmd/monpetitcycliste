import { useState, useEffect, useRef, Dispatch, SetStateAction } from "react";

/**
 * useState drop-in that persists value in sessionStorage.
 * Lets a component remount (e.g. after navigation back) without losing UI state
 * such as filters, search query, active tab, etc.
 *
 * Key should be unique per page/feature (e.g. "auction.mobile.search").
 * If sessionStorage is unavailable (SSR, privacy mode), it silently falls back
 * to plain in-memory state.
 */
export function usePersistentState<T>(
  key: string,
  defaultValue: T
): [T, Dispatch<SetStateAction<T>>] {
  const initial = useRef<T>(defaultValue);

  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw === null) return defaultValue;
      return JSON.parse(raw) as T;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Quota exceeded or disabled — ignore.
    }
  }, [key, state]);

  // If the key changes mid-life, reset to the new key's stored value (or default).
  const previousKey = useRef(key);
  useEffect(() => {
    if (previousKey.current === key) return;
    previousKey.current = key;
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(key);
      setState(raw === null ? initial.current : (JSON.parse(raw) as T));
    } catch {
      setState(initial.current);
    }
  }, [key]);

  return [state, setState];
}
