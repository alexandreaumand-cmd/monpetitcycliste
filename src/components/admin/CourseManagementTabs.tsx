import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RecentResults } from "./RecentResults";
import { PointsComputeManager } from "./PointsComputeManager";
import { CourseResultsResetManager } from "./CourseResultsResetManager";

export const CourseManagementTabs = () => {
  return (
    <Tabs defaultValue="results" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="results">📝 Résultats</TabsTrigger>
        <TabsTrigger value="points">🧮 Recalcul Points</TabsTrigger>
        <TabsTrigger value="reset">🗑️ Reset Résultats</TabsTrigger>
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
    </Tabs>
  );
};
