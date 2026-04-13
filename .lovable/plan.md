

# Plan : Corriger la vulnérabilité de sécurité du package `xlsx`

## Problème
Le package `xlsx` (SheetJS) v0.18.5 présente des vulnérabilités connues (Prototype Pollution + ReDoS). Il est utilisé dans 3 fichiers pour de l'**export uniquement** (conversion JSON → XLSX et écriture de fichier).

## Solution
Remplacer `xlsx` par **`ExcelJS`** (`exceljs`), un package activement maintenu sans ces vulnérabilités, qui offre les mêmes fonctionnalités d'export.

## Modifications

### 1. `package.json`
- Retirer `xlsx` des dépendances
- Ajouter `exceljs` et `file-saver` (pour le téléchargement côté client)

### 2. `src/pages/CalendarPage.tsx`
Remplacer l'import et l'appel XLSX par ExcelJS :
- `new ExcelJS.Workbook()` → `addWorksheet()` → `addRows()` → `writeBuffer()` → télécharger via Blob

### 3. `src/pages/RidersData.tsx`
Même remplacement — export JSON vers XLSX via ExcelJS

### 4. `src/components/team/LeagueRostersOverviewDialog.tsx`
Même remplacement — export array-of-arrays vers XLSX via ExcelJS

Les 3 fichiers suivent le même pattern simple : créer un workbook, ajouter une feuille avec des données, télécharger le fichier.

