import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminLeaguePicker } from "@/components/admin/AdminLeaguePicker";

export function LeaguesAdminPage() {
  return (
    <div className="space-y-6 p-3 sm:p-0">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Administration des ligues</h1>
        <p className="text-muted-foreground mt-1">
          Gérez les paramètres et membres de vos ligues
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sélectionner une ligue</CardTitle>
          <CardDescription>
            Choisissez la ligue que vous souhaitez administrer
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminLeaguePicker />
        </CardContent>
      </Card>
    </div>
  );
}
