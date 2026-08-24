/**
 * Shared ProCyclingStats fetch helper.
 *
 * PCS started rejecting requests that only carry a bare User-Agent header (403).
 * A full, realistic browser header set gets a 200. This helper centralizes those
 * headers and adds a retry policy with User-Agent rotation.
 */

const BROWSER_PROFILES = [
  {
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    lang: "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
  },
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    lang: "fr-FR,fr;q=0.9,en;q=0.8",
  },
  {
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    lang: "en-US,en;q=0.9,fr;q=0.8",
  },
];

const RETRY_DELAYS_MS = [500, 1500, 3500];

export class PcsFetchError extends Error {
  status: number;
  url: string;
  attempts: number;

  constructor(status: number, url: string, attempts: number) {
    super(
      status === 403 || status === 429
        ? `PCS a refusé la requête (HTTP ${status}) après ${attempts} tentative(s) — ${url}`
        : `Échec de récupération de la page PCS (HTTP ${status}) après ${attempts} tentative(s) — ${url}`,
    );
    this.name = "PcsFetchError";
    this.status = status;
    this.url = url;
    this.attempts = attempts;
  }
}

function buildHeaders(profileIndex: number, referer?: string): Record<string, string> {
  const profile = BROWSER_PROFILES[profileIndex % BROWSER_PROFILES.length];
  return {
    "User-Agent": profile.ua,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": profile.lang,
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    Referer: referer ?? "https://www.procyclingstats.com/",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-User": "?1",
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch a ProCyclingStats URL with full browser headers and retries.
 * Throws PcsFetchError when PCS keeps refusing.
 */
export async function fetchPcs(
  url: string,
  options: { referer?: string; extraHeaders?: Record<string, string>; maxAttempts?: number } = {},
): Promise<Response> {
  const maxAttempts = options.maxAttempts ?? RETRY_DELAYS_MS.length + 1;
  let lastStatus = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { ...buildHeaders(attempt, options.referer), ...(options.extraHeaders ?? {}) },
        redirect: "follow",
      });
    } catch (e) {
      lastStatus = 0;
      console.warn(`[pcsFetch] Network error (attempt ${attempt + 1}) for ${url}:`, e);
      if (attempt < maxAttempts - 1) {
        await sleep(RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]);
        continue;
      }
      throw e;
    }

    if (response.ok) return response;

    lastStatus = response.status;
    // Drain the body so the connection can be reused.
    try {
      await response.text();
    } catch (_) {
      /* ignore */
    }

    const retriable = response.status === 403 || response.status === 429 || response.status >= 500;
    console.warn(
      `[pcsFetch] HTTP ${response.status} (attempt ${attempt + 1}/${maxAttempts}) for ${url}${retriable ? " — retrying" : ""}`,
    );
    if (!retriable || attempt === maxAttempts - 1) {
      throw new PcsFetchError(response.status, url, attempt + 1);
    }
    await sleep(RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]);
  }

  throw new PcsFetchError(lastStatus || 500, url, maxAttempts);
}

/** Convenience: fetch and return the HTML text. */
export async function fetchPcsHtml(
  url: string,
  options?: { referer?: string; extraHeaders?: Record<string, string>; maxAttempts?: number },
): Promise<string> {
  const res = await fetchPcs(url, options);
  return await res.text();
}
