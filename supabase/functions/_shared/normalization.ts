// ============ NORMALISATION & UTILITAIRES V2 ============

export const CHAR_MAP: Record<string, string> = {
  'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a', 'æ': 'ae',
  'ç': 'c', 'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
  'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
  'ñ': 'n', 'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o', 'ø': 'o',
  'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
  'ý': 'y', 'ÿ': 'y', 'ß': 'ss', 'œ': 'oe',
  'À': 'A', 'Á': 'A', 'Â': 'A', 'Ã': 'A', 'Ä': 'A', 'Å': 'A', 'Æ': 'AE',
  'Ç': 'C', 'È': 'E', 'É': 'E', 'Ê': 'E', 'Ë': 'E',
  'Ì': 'I', 'Í': 'I', 'Î': 'I', 'Ï': 'I',
  'Ñ': 'N', 'Ò': 'O', 'Ó': 'O', 'Ô': 'O', 'Õ': 'O', 'Ö': 'O', 'Ø': 'O',
  'Ù': 'U', 'Ú': 'U', 'Û': 'U', 'Ü': 'U',
  'Ý': 'Y', 'Ÿ': 'Y', 'Œ': 'OE'
};

export const PARTICLES = ['VAN', 'VAN DER', 'VAN DEN', 'VAN DE', 'DE', 'DI', 'DA', 'DEL', 'DELLA', 'VON', 'LE', 'LA'];

export function normalize(s: string): string {
  if (!s) return '';
  let result = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  result = result.split('').map(c => CHAR_MAP[c] || c).join('');
  result = result.replace(/['']/g, "'").replace(/[.\-]/g, ' ').replace(/\s+/g, ' ').trim();
  return result.toUpperCase();
}

export function tokenSig(s: string): string {
  return normalize(s).split(/\s+/).filter(t => t.length > 0).sort().join(' ');
}

export function extractLastName(s: string): string {
  const norm = normalize(s);
  const tokens = norm.split(/\s+/).filter(t => t.length > 0);
  if (tokens.length === 0) return '';
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (!PARTICLES.includes(tokens[i])) return tokens[i];
  }
  return tokens[tokens.length - 1];
}

export function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  const n = a.length, m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;
  for (let i = 0; i <= n; i++) matrix[i] = [i];
  for (let j = 0; j <= m; j++) matrix[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[n][m];
}

export function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  return 1.0 - (levenshtein(a, b) / maxLen);
}

export function canonizeName(raw: string): string {
  const tokens = raw.trim().split(/\s+/);
  if (tokens.length < 2) return raw;
  const firstToken = tokens[0];
  const isFirstAllCaps = firstToken === firstToken.toUpperCase() && firstToken.length > 1;
  if (isFirstAllCaps) {
    let lastNameEndIdx = 0;
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      // Include both all-caps tokens AND particles in the last name
      if ((tok === tok.toUpperCase() && tok.length > 1) || PARTICLES.includes(tok)) {
        lastNameEndIdx = i;
      } else {
        break;
      }
    }
    const lastName = tokens.slice(0, lastNameEndIdx + 1).join(' ');
    const firstName = tokens.slice(lastNameEndIdx + 1).join(' ');
    if (firstName && lastName) return `${firstName} ${lastName}`;
  }
  return raw;
}
