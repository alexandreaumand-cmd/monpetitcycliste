

# Business Card Design for La Bordure

## Overview
Create print-ready business cards (front + back) as PDF files using Python/reportlab, following the brand identity strictly.

## Assets
- Logo (dark): `src/assets/logo-bordure.png`
- Logo (light): `src/assets/logo-bordure-light.png`
- Square logo: `src/assets/logo-carre-sans-marque.png` (likely the clean square version)

## Design Specs

### Front Face
- **Background**: Crème #F6F3ED
- **Layout** (centered, top to bottom):
  1. Square logo (~15mm)
  2. Thin decorative line in forest green #1B5E3B
  3. "LA BORDURE" — dark green #2D3D32, bold, uppercase, large
  4. "Fantasy Cycling Game" — muted gray #8A9188, small caps
  5. "labordure.app" — gold #C8963A

### Back Face
- **Background**: Solid forest green #1B5E3B
- **Layout** (centered):
  1. Light logo in crème/white
  2. Tagline: "Build your dream team. Race to glory." — crème #F6F3ED
  3. "labordure.app" — gold #C8963A

### Dimensions
- 91 × 61 mm (85×55 + 3mm bleed on each side)
- Safe zone: 5mm from trim edge

## Technical Approach
1. Use reportlab to generate a single PDF with two pages (front + back)
2. Embed logos as images from `src/assets/`
3. Use Inter font (copy from skill fonts if available, else fallback to Helvetica)
4. Export to `/mnt/documents/la-bordure-business-card.pdf`
5. QA: convert to images and inspect

## Deliverable
- `la-bordure-business-card.pdf` — 2-page PDF (page 1 = front, page 2 = back)

