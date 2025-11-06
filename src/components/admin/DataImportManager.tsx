import { Accordion } from "@/components/ui/accordion";
import { CoursesImportSection } from "./import/CoursesImportSection";
import { CoureursImportSection } from "./import/CoureursImportSection";
import { BaremesImportSection } from "./import/BaremesImportSection";
import { RostersImportSection } from "./import/RostersImportSection";
import { ResultatsImportSection } from "./import/ResultatsImportSection";
import { MattLImportSection } from "./import/MattLImportSection";

export const DataImportManager = () => {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Importez vos données à partir de fichiers CSV. Chaque section fournit un template téléchargeable avec des exemples.
      </p>
      
      <Accordion type="single" collapsible className="space-y-2">
        <CoursesImportSection />
        <CoureursImportSection />
        <BaremesImportSection />
        <RostersImportSection />
        <ResultatsImportSection />
        <MattLImportSection />
      </Accordion>
    </div>
  );
};
