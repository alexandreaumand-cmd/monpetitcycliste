import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ManagerStatusCard } from "./ManagerStatusCard";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useState } from "react";

interface ManagerStatus {
  nom: string;
  status: 'validated' | 'pending' | 'incomplete';
  slots_filled: number;
  max_slots: number;
  budget_used: number;
  total_budget: number;
  budget_remaining: number;
  last_activity: string | null;
}

interface ManagersSupervisionProps {
  managers: ManagerStatus[];
  isLoading?: boolean;
}

export const ManagersSupervision = ({ managers, isLoading }: ManagersSupervisionProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Filter managers based on search and status
  const filteredManagers = managers.filter(m => {
    const matchesSearch = m.nom.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Sort managers: incomplete > pending > validated
  const sortedManagers = [...filteredManagers].sort((a, b) => {
    const priority = { incomplete: 0, pending: 1, validated: 2 };
    return priority[a.status] - priority[b.status];
  });

  const counts = {
    validated: managers.filter(m => m.status === 'validated').length,
    pending: managers.filter(m => m.status === 'pending').length,
    incomplete: managers.filter(m => m.status === 'incomplete').length
  };

  return (
    <Card>
      <CardHeader className="space-y-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Supervision Managers
          </div>
          <div className="flex gap-2">
            {counts.incomplete > 0 && (
              <Badge variant="destructive">{counts.incomplete} incomplet</Badge>
            )}
            {counts.pending > 0 && (
              <Badge variant="secondary">{counts.pending} en attente</Badge>
            )}
            <Badge variant="outline">{counts.validated} validés</Badge>
          </div>
        </CardTitle>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <Input 
            placeholder="Rechercher un manager..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-xs"
          />
          <ToggleGroup 
            type="single" 
            value={statusFilter} 
            onValueChange={(value) => setStatusFilter(value || "all")}
            className="justify-start"
          >
            <ToggleGroupItem value="all" aria-label="Tous">
              Tous
            </ToggleGroupItem>
            <ToggleGroupItem value="pending" aria-label="En attente">
              En attente
            </ToggleGroupItem>
            <ToggleGroupItem value="validated" aria-label="Validés">
              Validés
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">
            Chargement...
          </div>
        ) : managers.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            Aucun manager
          </div>
        ) : (
          <div className="grid gap-3 max-h-[600px] overflow-y-auto">
            {sortedManagers.map((manager, index) => (
              <ManagerStatusCard key={index} manager={manager} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
