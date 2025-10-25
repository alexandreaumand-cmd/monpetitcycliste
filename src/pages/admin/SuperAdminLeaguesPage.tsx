import { SuperAdminGuard } from "@/components/guards/SuperAdminGuard";
import { SuperAdminLeaguesOverview } from "@/components/admin/leagues/SuperAdminLeaguesOverview";
import { SuperAdminLeaguesTable } from "@/components/admin/leagues/SuperAdminLeaguesTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { Shield } from "lucide-react";

export function SuperAdminLeaguesPage() {
  return (
    <SuperAdminGuard>
      <div className="space-y-6 p-3 sm:p-0">
        <PageHeader
          icon={Shield}
          title="Gestion des ligues"
          subtitle="Vue d'ensemble et administration de toutes les ligues de la plateforme"
        />

        <SuperAdminLeaguesOverview />

        <SuperAdminLeaguesTable />
      </div>
    </SuperAdminGuard>
  );
}
