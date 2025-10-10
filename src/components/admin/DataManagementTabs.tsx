import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CoursesImportManager } from "./CoursesImportManager";
import { CoursesResetManager } from "./CoursesResetManager";
import { PointsComputeManager } from "./PointsComputeManager";
import { DataImport } from "./DataImport";

export const DataManagementTabs = () => {
  return (
    <Tabs defaultValue="courses" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="courses">Import Courses</TabsTrigger>
        <TabsTrigger value="other">Import Autres</TabsTrigger>
        <TabsTrigger value="points">Calcul Points</TabsTrigger>
        <TabsTrigger value="reset">Reset/Purge</TabsTrigger>
      </TabsList>

      <TabsContent value="courses" className="space-y-6">
        <CoursesImportManager />
      </TabsContent>

      <TabsContent value="other" className="space-y-6">
        <DataImport />
      </TabsContent>

      <TabsContent value="points" className="space-y-6">
        <PointsComputeManager />
      </TabsContent>

      <TabsContent value="reset" className="space-y-6">
        <CoursesResetManager />
      </TabsContent>
    </Tabs>
  );
};
