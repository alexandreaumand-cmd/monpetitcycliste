import { CoursesExportCard } from "./export/CoursesExportCard";
import { CoureursExportCard } from "./export/CoureursExportCard";
import { BaremesExportCard } from "./export/BaremesExportCard";
import { RostersExportCard } from "./export/RostersExportCard";
import { ResultatsExportCard } from "./export/ResultatsExportCard";

export const DataExportManager = () => {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Exportez vos données au format CSV. Les fichiers peuvent être réimportés ou utilisés pour des analyses externes.
      </p>
      
      <div className="grid gap-4 md:grid-cols-2">
        <CoursesExportCard />
        <CoureursExportCard />
        <BaremesExportCard />
        <RostersExportCard />
        <ResultatsExportCard />
      </div>
    </div>
  );
};
