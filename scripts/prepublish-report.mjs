#!/usr/bin/env node
/**
 * Prepublish size report
 * --------------------------------
 * Audite rapidement les volumes susceptibles de faire crasher le sandbox
 * de publication Lovable (OOM / timeout). À lancer avant chaque Publish:
 *
 *   node scripts/prepublish-report.mjs
 *
 * Ou via npm script:  bun run report
 */
import { readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();

// Seuils empiriques (à ajuster). Au-dessus = risque de crash publish.
const THRESHOLDS = {
  edgeFunctions: 130,
  assetsMB: 8,
  migrations: 600,
  distMB: 12,
  singleAssetKB: 500,
};

const c = {
  reset: "\x1b[0m", red: "\x1b[31m", green: "\x1b[32m",
  yellow: "\x1b[33m", cyan: "\x1b[36m", bold: "\x1b[1m",
};

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else out.push({ path: p, size: s.size });
  }
  return out;
}

function fmtMB(bytes) { return (bytes / 1024 / 1024).toFixed(2) + " MB"; }
function status(value, threshold) {
  return value > threshold ? `${c.red}⚠ ${value}${c.reset}` : `${c.green}✓ ${value}${c.reset}`;
}

console.log(`\n${c.bold}${c.cyan}📦 Prepublish size report${c.reset}\n${"─".repeat(50)}`);

// 1. Edge functions
const fnDir = join(ROOT, "supabase/functions");
const edgeFunctions = existsSync(fnDir)
  ? readdirSync(fnDir).filter(n => statSync(join(fnDir, n)).isDirectory()).length
  : 0;
console.log(`Edge functions     : ${status(edgeFunctions, THRESHOLDS.edgeFunctions)} / ${THRESHOLDS.edgeFunctions}`);

// 2. Migrations
const migDir = join(ROOT, "supabase/migrations");
const migrations = existsSync(migDir)
  ? readdirSync(migDir).filter(n => n.endsWith(".sql")).length
  : 0;
console.log(`Migrations         : ${status(migrations, THRESHOLDS.migrations)} / ${THRESHOLDS.migrations}`);

// 3. Assets bruts (src/assets + public)
const assetFiles = [
  ...walk(join(ROOT, "src/assets")),
  ...walk(join(ROOT, "public")).filter(f => /\.(png|jpe?g|webp|avif|gif|svg|mp4|mov|pdf)$/i.test(f.path)),
];
const totalAssetBytes = assetFiles.reduce((a, f) => a + f.size, 0);
const totalAssetMB = +(totalAssetBytes / 1024 / 1024).toFixed(2);
console.log(`Assets bruts       : ${status(totalAssetMB, THRESHOLDS.assetsMB)} MB / ${THRESHOLDS.assetsMB} MB  (${assetFiles.length} fichiers)`);

// 4. Top 10 plus gros assets
const top = [...assetFiles].sort((a, b) => b.size - a.size).slice(0, 10);
console.log(`\n${c.bold}Top 10 assets:${c.reset}`);
for (const f of top) {
  const kb = f.size / 1024;
  const tag = kb > THRESHOLDS.singleAssetKB ? `${c.yellow}⚠${c.reset}` : " ";
  console.log(`  ${tag} ${(kb).toFixed(0).padStart(6)} KB  ${relative(ROOT, f.path)}`);
}

// 5. Dist (si build a déjà tourné)
const distDir = join(ROOT, "dist");
if (existsSync(distDir)) {
  const distBytes = walk(distDir).reduce((a, f) => a + f.size, 0);
  const distMB = +(distBytes / 1024 / 1024).toFixed(2);
  console.log(`\nDist build         : ${status(distMB, THRESHOLDS.distMB)} MB / ${THRESHOLDS.distMB} MB`);
} else {
  console.log(`\nDist build         : ${c.yellow}non buildé${c.reset}  (lance \`bun run build\` pour mesurer)`);
}

// 6. JSON snapshot pour l'écran d'admin
import { writeFileSync, mkdirSync } from "node:fs";
const distBytesIfExists = existsSync(distDir) ? walk(distDir).reduce((a, f) => a + f.size, 0) : null;
const snapshot = {
  generatedAt: new Date().toISOString(),
  thresholds: THRESHOLDS,
  edgeFunctions,
  migrations,
  assets: {
    count: assetFiles.length,
    totalMB: totalAssetMB,
    top: top.map(f => ({ path: relative(ROOT, f.path), kb: +(f.size / 1024).toFixed(1) })),
  },
  distMB: distBytesIfExists != null ? +(distBytesIfExists / 1024 / 1024).toFixed(2) : null,
};
try {
  mkdirSync(join(ROOT, "public"), { recursive: true });
  writeFileSync(join(ROOT, "public/publish-health.json"), JSON.stringify(snapshot, null, 2));
  console.log(`\n${c.cyan}↳ snapshot écrit dans public/publish-health.json${c.reset}`);
} catch (e) {
  console.warn(`Impossible d'écrire le snapshot: ${e.message}`);
}

// 7. Verdict
const warnings = [];
if (edgeFunctions > THRESHOLDS.edgeFunctions) warnings.push(`Trop d'edge functions (${edgeFunctions})`);
if (totalAssetMB > THRESHOLDS.assetsMB) warnings.push(`Assets trop volumineux (${totalAssetMB} MB)`);
if (migrations > THRESHOLDS.migrations) warnings.push(`Beaucoup de migrations (${migrations})`);

console.log(`\n${"─".repeat(50)}`);
if (warnings.length) {
  console.log(`${c.red}${c.bold}⚠ Risque d'échec de publication${c.reset}`);
  warnings.forEach(w => console.log(`  • ${w}`));
  process.exit(1);
} else {
  console.log(`${c.green}${c.bold}✓ Volumes OK pour publication${c.reset}`);
}
