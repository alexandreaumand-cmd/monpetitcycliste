// Renders a race-result standings card (SVG -> PNG) without any browser.
import { initWasm, Resvg } from 'https://esm.sh/@resvg/resvg-wasm@2.6.2';

const WASM_URL = 'https://esm.sh/@resvg/resvg-wasm@2.6.2/index_bg.wasm';
const FONT_REGULAR = 'https://cdn.jsdelivr.net/npm/@expo-google-fonts/inter@0.2.3/Inter_400Regular.ttf';
const FONT_BOLD = 'https://cdn.jsdelivr.net/npm/@expo-google-fonts/inter@0.2.3/Inter_700Bold.ttf';

let wasmReady: Promise<void> | null = null;
let fontBuffers: Uint8Array[] | null = null;

async function ensureWasm() {
  if (!wasmReady) {
    wasmReady = (async () => {
      const res = await fetch(WASM_URL);
      await initWasm(new Uint8Array(await res.arrayBuffer()));
    })();
  }
  await wasmReady;
}

async function ensureFonts(): Promise<Uint8Array[]> {
  if (!fontBuffers) {
    const [regular, bold] = await Promise.all([
      fetch(FONT_REGULAR).then((r) => r.arrayBuffer()),
      fetch(FONT_BOLD).then((r) => r.arrayBuffer()),
    ]);
    fontBuffers = [new Uint8Array(regular), new Uint8Array(bold)];
  }
  return fontBuffers;
}

export type StandingRow = {
  position: number;
  riderName: string;
  teamName: string | null;
  points: number | null;
};

export type CardData = {
  title: string;
  subtitle: string;
  rows: StandingRow[];
};

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const truncate = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

export function buildStandingsSvg(data: CardData): string {
  const width = 1200;
  const headerHeight = 190;
  const rowHeight = 62;
  const footerHeight = 84;
  const height = headerHeight + data.rows.length * rowHeight + footerHeight;

  const rows = data.rows
    .map((row, index) => {
      const y = headerHeight + index * rowHeight;
      const stripe = index % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'transparent';
      const isPodium = row.position <= 3;
      const posColor = isPodium ? '#facc15' : '#94a3b8';
      const points = row.points === null ? '—' : `${Number(row.points)} pts`;
      return `
        <rect x="0" y="${y}" width="${width}" height="${rowHeight}" fill="${stripe}" />
        <text x="72" y="${y + 41}" font-family="Inter" font-weight="700" font-size="30" fill="${posColor}" text-anchor="end">${row.position}</text>
        <text x="104" y="${y + 41}" font-family="Inter" font-weight="700" font-size="29" fill="#f8fafc">${escapeXml(truncate(row.riderName, 30))}</text>
        <text x="600" y="${y + 41}" font-family="Inter" font-weight="400" font-size="24" fill="#94a3b8">${escapeXml(truncate(row.teamName ?? '', 28))}</text>
        <text x="1128" y="${y + 41}" font-family="Inter" font-weight="700" font-size="28" fill="#facc15" text-anchor="end">${escapeXml(points)}</text>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1220" />
      <stop offset="100%" stop-color="#111f38" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)" />
  <rect x="0" y="0" width="${width}" height="10" fill="#facc15" />
  <text x="72" y="96" font-family="Inter" font-weight="700" font-size="46" fill="#f8fafc">${escapeXml(truncate(data.title, 42))}</text>
  <text x="72" y="141" font-family="Inter" font-weight="400" font-size="27" fill="#94a3b8">${escapeXml(truncate(data.subtitle, 66))}</text>
  <line x1="72" y1="170" x2="1128" y2="170" stroke="rgba(255,255,255,0.12)" stroke-width="2" />
  ${rows}
  <text x="72" y="${height - 30}" font-family="Inter" font-weight="700" font-size="26" fill="#facc15">Labordure.app</text>
  <text x="1128" y="${height - 30}" font-family="Inter" font-weight="400" font-size="22" fill="#94a3b8" text-anchor="end">#labordure_lejeu</text>
</svg>`;
}

export async function renderStandingsPng(data: CardData): Promise<Uint8Array> {
  await ensureWasm();
  const fonts = await ensureFonts();

  const resvg = new Resvg(buildStandingsSvg(data), {
    fitTo: { mode: 'width', value: 1200 },
    font: {
      fontBuffers: fonts,
      defaultFontFamily: 'Inter',
      loadSystemFonts: false,
    },
  });

  return resvg.render().asPng();
}
