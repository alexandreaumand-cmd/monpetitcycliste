import { CoursesExportCard } from "./export/CoursesExportCard";
import { CoureursExportCard } from "./export/CoureursExportCard";
import { BaremesExportCard } from "./export/BaremesExportCard";
import { RostersExportCard } from "./export/RostersExportCard";
import { ResultatsExportCard } from "./export/ResultatsExportCard";
import { FullDatabaseExportCard } from "./export/FullDatabaseExportCard";
import { Separator } from "@/components/ui/separator";

export const DataExportManager = () => {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Exportez vos données au format CSV. Les fichiers peuvent être réimportés ou utilisés pour des analyses externes.
      </p>
      
      {/* Full database export - highlighted */}
      <FullDatabaseExportCard />
      
      {/* Separator */}
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-sm text-muted-foreground font-medium">Exports individuels</span>
        <Separator className="flex-1" />
      </div>
      
      {/* Individual exports */}
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
