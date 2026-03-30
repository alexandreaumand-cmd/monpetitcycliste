import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RecentResults } from "./RecentResults";
import { PointsComputeManager } from "./PointsComputeManager";
import { CourseResultsResetManager } from "./CourseResultsResetManager";
import { RaceResultsTable } from "./RaceResultsTable";

export const CourseManagementTabs = () => {
  return (
    <Tabs defaultValue="results" className="w-full">
      <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
        <TabsTrigger value="results">📝 <span className="hidden sm:inline">Résultats</span><span className="sm:hidden">Résult.</span></TabsTrigger>
        <TabsTrigger value="points">🧮 <span className="hidden sm:inline">Recalcul Points</span><span className="sm:hidden">Points</span></TabsTrigger>
        <TabsTrigger value="reset">🗑️ <span className="hidden sm:inline">Reset Résultats</span><span className="sm:hidden">Reset</span></TabsTrigger>
        <TabsTrigger value="database">🗄️ <span className="hidden sm:inline">Base de données</span><span className="sm:hidden">BDD</span></TabsTrigger>
      </TabsList>

      <TabsContent value="results" className="space-y-6">
        <RecentResults />
      </TabsContent>

      <TabsContent value="points" className="space-y-6">
        <PointsComputeManager />
      </TabsContent>

      <TabsContent value="reset" className="space-y-6">
        <CourseResultsResetManager />
      </TabsContent>

      <TabsContent value="database" className="space-y-6">
        <RaceResultsTable />
      </TabsContent>
    </Tabs>
  );
};
