import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MaintenanceStatus } from "./maintenance/MaintenanceStatus";
import { BannerConfigSection } from "./maintenance/BannerConfigSection";
import { PhaseUpdateSection } from "./maintenance/PhaseUpdateSection";
import { RepairSection } from "./maintenance/RepairSection";
import { CleanupSection } from "./maintenance/CleanupSection";
import { ResetSection } from "./maintenance/ResetSection";
import { AuctionResetManager } from "./AuctionResetManager";
import { Activity, Settings, Wrench, AlertTriangle } from "lucide-react";

export const MaintenanceTabs = () => {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-bold">Maintenance</h2>
        <p className="text-muted-foreground mt-2">
          Outils de maintenance et configuration système
        </p>
      </div>

      <Tabs defaultValue="status" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="status" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Statut</span>
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Configuration</span>
          </TabsTrigger>
          <TabsTrigger value="repair" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            <span className="hidden sm:inline">Réparations</span>
          </TabsTrigger>
          <TabsTrigger value="danger" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">Danger Zone</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="space-y-6">
          <MaintenanceStatus />
        </TabsContent>

        <TabsContent value="config" className="space-y-6">
          <BannerConfigSection />
          <PhaseUpdateSection />
        </TabsContent>

        <TabsContent value="repair" className="space-y-6">
          <RepairSection />
        </TabsContent>

        <TabsContent value="danger" className="space-y-6">
          <AuctionResetManager />
          <CleanupSection />
          <ResetSection />
        </TabsContent>
      </Tabs>
    </div>
  );
};
