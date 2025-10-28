import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Search } from "lucide-react";
import { useState } from "react";
import { ManagersTable } from "./ManagersTable";

interface ManagerStatus {
  manager_id: string;
  manager_nom: string;
  current_round_riders: number;
  current_round_budget: number;
  previous_rounds_riders: number;
  previous_rounds_budget: number;
  slots_missing: number;
  max_slots: number;
  budget_total: number;
  last_activity: string | null;
  riders_per_round: number[];
}

interface ManagersSupervisionProps {
  managers: ManagerStatus[];
  isLoading?: boolean;
}

export const ManagersSupervision = ({ managers, isLoading }: ManagersSupervisionProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Filter managers based on search and completion status
  const filteredManagers = managers.filter(m => {
    const matchesSearch = (m.manager_nom || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === "all") return matchesSearch;
    if (statusFilter === "incomplete") return matchesSearch && m.slots_missing > 0;
    if (statusFilter === "complete") return matchesSearch && m.slots_missing === 0;
    
    return matchesSearch;
  });

  const incompleteCount = managers.filter(m => m.slots_missing > 0).length;
  const completeCount = managers.filter(m => m.slots_missing === 0).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Supervision Managers</span>
          <div className="text-sm font-normal text-muted-foreground">
            {completeCount}/{managers.length} complets
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Filter */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un manager..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <ToggleGroup type="single" value={statusFilter} onValueChange={(value) => value && setStatusFilter(value)}>
            <ToggleGroupItem value="all" aria-label="Tous">
              Tous
            </ToggleGroupItem>
            <ToggleGroupItem value="incomplete" aria-label="Incomplets">
              Incomplets ({incompleteCount})
            </ToggleGroupItem>
            <ToggleGroupItem value="complete" aria-label="Complets">
              Complets ({completeCount})
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Managers Table */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Chargement des managers...
          </div>
        ) : (
          <ManagersTable managers={filteredManagers} />
        )}
      </CardContent>
    </Card>
  );
};
