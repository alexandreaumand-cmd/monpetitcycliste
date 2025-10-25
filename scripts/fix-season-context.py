#!/usr/bin/env python3
"""
Script pour remplacer automatiquement useSeasonContext par useLeagueSeason
dans tous les fichiers restants
"""

import re
from pathlib import Path

# Liste des fichiers à modifier
FILES_TO_FIX = [
    "src/components/admin/RecentResults.desktop.tsx",
    "src/components/admin/RecentResults.mobile.tsx", 
    "src/components/admin/StartlistImportManager.tsx",
    "src/components/auction/AuctionTeamsGrid.tsx",
    "src/components/courses/UpcomingCourses.desktop.tsx",
    "src/components/courses/UpcomingCourses.mobile.tsx",
    "src/components/team/MyTeam.desktop.tsx",
    "src/components/team/MyTeam.mobile.tsx",
    "src/pages/Rankings.mobile.tsx",
    "src/pages/Rankings.tsx",
    "src/pages/ResultsPage.desktop.tsx",
    "src/pages/ResultsPage.mobile.tsx",
    "src/pages/Startlist.desktop.tsx",
    "src/pages/Startlist.mobile.tsx",
    "src/pages/Statistics.tsx",
]

def fix_file(filepath):
    """Applique les corrections à un fichier"""
    path = Path(filepath)
    if not path.exists():
        print(f"❌ Fichier non trouvé: {filepath}")
        return False
    
    content = path.read_text(encoding='utf-8')
    original = content
    
    # 1. Remplacer l'import
    content = content.replace(
        'from "@/contexts/SeasonContext"',
        'from "@/hooks/useLeagueSeason"'
    )
    
    # 2. Remplacer le hook
    content = content.replace('useSeasonContext', 'useLeagueSeason')
    
    # 3. Remplacer les variables destructurées (patterns courants)
    # const { selectedSeason } → const { season }
    content = re.sub(
        r'const\s*{\s*selectedSeason\s*}',
        'const { season }',
        content
    )
    
    # const { selectedSeason, ... } → const { season, ... }
    content = re.sub(
        r'selectedSeason,',
        'season,',
        content
    )
    
    # Remplacer les usages de selectedSeason par season
    content = re.sub(
        r'\bselectedSeason\b',
        'season',
        content
    )
    
    # Supprimer setSelectedSeason (plus utilisé)
    content = re.sub(
        r',?\s*setSelectedSeason',
        '',
        content
    )
    
    if content != original:
        path.write_text(content, encoding='utf-8')
        print(f"✅ Corrigé: {filepath}")
        return True
    else:
        print(f"⚠️  Aucun changement: {filepath}")
        return False

def main():
    print("🔧 Correction automatique de SeasonContext → useLeagueSeason\n")
    
    fixed_count = 0
    for filepath in FILES_TO_FIX:
        if fix_file(filepath):
            fixed_count += 1
    
    print(f"\n✨ Terminé! {fixed_count}/{len(FILES_TO_FIX)} fichiers modifiés")

if __name__ == "__main__":
    main()
