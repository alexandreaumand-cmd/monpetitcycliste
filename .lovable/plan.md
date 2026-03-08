

# Plan: Réorganisation du Super Admin (Desktop & Mobile)

## Problèmes identifiés

1. **14 items de navigation en liste plate** -- trop d'entrées sans hiérarchie, difficile de s'y retrouver
2. **Redondance Startlists** -- 3 entrées séparées (Startlists, Startlist Tracker, Données Startlists) qui pourraient être regroupées
3. **"Données" fourre-tout** -- contient import, export, managers, enchères, saisons, maintenance en sous-onglets
4. **Ordre différent mobile/desktop** -- Bonus n'est pas au même endroit
5. **Sidebar desktop non repliable** -- pas de groupes visuels, longue liste monotone
6. **Pas de titre de section** -- aucune séparation logique entre les catégories

## Proposition de réorganisation

Regrouper les 14 items en **4 catégories** avec des séparateurs visuels (collapsible groups sur desktop, sections dans le sheet mobile) :

```text
📊 COURSES & RÉSULTATS
  ├── Résultats        (CourseManagementTabs)
  ├── Bonus            (SuperAdminBonusPage)
  ├── Courses          (CoursesManager)
  └── Barèmes          (BaremesManager)

👥 COUREURS & ÉQUIPES
  ├── Coureurs         (CoureursManager)
  ├── Équipes          (EquipesSaisonsManager)
  └── Startlists       (nouveau: regroupe les 3 onglets startlist)

🏆 LIGUES & ARÈNE
  ├── Ligues           (SuperAdminLeaguesPage)
  ├── Utilisateurs     (UsersManagementPage)
  └── Arène            (PronosticDeadlinesManager)

⚙️ DONNÉES & MAINTENANCE
  ├── Import / Export  (DataImportManager + DataExportManager)
  ├── Points Ledger    (PointsLedgerTable)
  └── Maintenance      (MaintenanceTabs + SeasonManager + etc.)
```

## Modifications techniques

### 1. Fusionner les 3 pages Startlist en une seule page à onglets
Créer `StartlistHub.tsx` avec 3 onglets : Import, Tracker, Données. Supprime 3 nav items → 1 seul.

### 2. Fusionner Import/Export + Maintenance
Simplifier `DataManagementTabs` : retirer les sous-onglets Managers/Enchères/Saisons (déjà accessibles ailleurs ou à intégrer dans Maintenance). Garder Import, Export, Maintenance.

### 3. Desktop - Sidebar groupée et repliable
- Remplacer la sidebar custom par des `Collapsible` groups avec titres de section
- Chaque groupe s'ouvre/ferme, le groupe actif reste ouvert par défaut
- Réduire de 14 à ~11 items grâce aux fusions

### 4. Mobile - Sheet avec sections
- Même regroupement dans le Sheet de navigation mobile
- Titres de section en `text-xs uppercase text-muted-foreground` comme séparateurs
- Harmoniser l'ordre avec le desktop

### 5. Harmoniser l'indentation et l'ordre des routes
- Nettoyer l'indentation incohérente dans les deux fichiers de routes
- S'assurer que l'ordre des `<Route>` correspond à l'ordre de la nav

## Fichiers impactés

| Fichier | Action |
|---|---|
| `src/components/admin/StartlistHub.tsx` | Créer — regroupe les 3 vues startlist |
| `src/pages/SuperAdminPage.desktop.tsx` | Modifier — sidebar groupée, routes nettoyées |
| `src/pages/SuperAdminPage.mobile.tsx` | Modifier — sheet avec sections, routes nettoyées |
| `src/components/admin/DataManagementTabs.tsx` | Simplifier — retirer les sous-onglets redondants |

