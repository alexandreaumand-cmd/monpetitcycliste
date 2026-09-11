/**
 * Returns a numeric priority for a course category.
 * Higher value = more prestigious, should appear first within the same date.
 */
export function getCourseCategoryPriority(categorie: string | null | undefined): number {
  const cat = (categorie || '').toUpperCase().trim();

  // World Championships
  if (cat.startsWith('WC ')) return 100;
  // European Championships
  if (cat.startsWith('EC ')) return 90;
  // National Championships
  if (cat.startsWith('CN_')) return 80;

  if (cat.includes('WT GT')) return 70;
  if (cat.includes('WT MONUMENT')) return 65;

  if (cat.includes('TOURS WT CAT 1')) return 60;
  if (cat.includes('TOURS WT CAT 2')) return 55;
  if (cat.includes('TOURS WT CAT 3')) return 50;

  if (cat.includes('CLASSIQUES WT CAT 1')) return 45;
  if (cat.includes('CLASSIQUES WT CAT 2')) return 40;
  if (cat.includes('CLASSIQUES WT CAT 3')) return 35;

  if (cat === '1.PRO') return 30;
  if (cat === '2.PRO') return 25;
  if (cat === '1.1') return 20;
  if (cat === '2.1') return 15;

  return 0;
}
