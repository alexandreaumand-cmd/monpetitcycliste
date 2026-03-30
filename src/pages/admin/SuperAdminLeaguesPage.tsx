import { SuperAdminGuard } from "@/components/guards/SuperAdminGuard";
import { SuperAdminLeaguesOverview } from "@/components/admin/leagues/SuperAdminLeaguesOverview";
import { SuperAdminLeaguesTable } from "@/components/admin/leagues/SuperAdminLeaguesTable";
import { LeagueTemplatesManager } from "@/components/admin/leagues/LeagueTemplatesManager";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield } from "lucide-react";

export function SuperAdminLeaguesPage() {
  return (
    <SuperAdminGuard>
      <div className="space-y-4 p-2 sm:p-0">
        <PageHeader
          icon={Shield}
          title="Gestion des ligues"
          subtitle="Vue d'ensemble et administration de toutes les ligues de la plateforme"
        />

        <Tabs defaultValue="leagues" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="leagues">Ligues</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="leagues" className="space-y-6">
            <SuperAdminLeaguesOverview />
            <SuperAdminLeaguesTable />
          </TabsContent>

          <TabsContent value="templates">
            <LeagueTemplatesManager />
          </TabsContent>
        </Tabs>
      </div>
    </SuperAdminGuard>
  );
}
