#!/bin/bash
# Script to replace SeasonContext with useLeagueSeason

# This is a temporary script to automate the replacement
# It will be deleted after the refactor is complete

FILES=(
  "src/components/admin/RecentResults.desktop.tsx"
  "src/components/admin/RecentResults.mobile.tsx"
  "src/components/admin/StartlistImportManager.tsx"
  "src/components/auction/AuctionTeamsGrid.tsx"
  "src/components/courses/UpcomingCourses.desktop.tsx"
  "src/components/courses/UpcomingCourses.mobile.tsx"
  "src/components/team/MyTeam.desktop.tsx"
  "src/components/team/MyTeam.mobile.tsx"
  "src/pages/Rankings.mobile.tsx"
  "src/pages/Rankings.tsx"
  "src/pages/ResultsPage.desktop.tsx"
  "src/pages/ResultsPage.mobile.tsx"
  "src/pages/Startlist.desktop.tsx"
  "src/pages/Startlist.mobile.tsx"
  "src/pages/Statistics.tsx"
)

for FILE in "${FILES[@]}"; do
  echo "Processing $FILE..."
  # Replace import
  sed -i 's/from "@\/contexts\/SeasonContext"/from "@\/hooks\/useLeagueSeason"/g' "$FILE"
  # Replace hook call
  sed -i 's/useSeasonContext/useLeagueSeason/g' "$FILE"
  # Replace variables (might need manual review)
  sed -i 's/selectedSeason/season/g' "$FILE"
  sed -i 's/setSelectedSeason//g' "$FILE"
done

echo "Done!"
