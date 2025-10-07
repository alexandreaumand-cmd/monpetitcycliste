import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatAmount } from "@/lib/utils";

interface AuctionTeamsGridProps {
  phaseId: string;
  managerId: string;
}

export const AuctionTeamsGrid = ({ phaseId, managerId }: AuctionTeamsGridProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  // Get all managers rosters
  const { data: allManagersRosters = [], isLoading } = useQuery({
    queryKey: ['all-managers-rosters', phaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rosters')
        .select(`
          *,
          coureurs(nom, equipe),
          managers(nom)
        `)
        .eq('phase_id', phaseId)
        .order('manager_id');

      if (error) throw error;
      return data || [];
    }
  });

  // Group rosters by manager (exclude current user)
  const rostersByManager = allManagersRosters
    .filter((r: any) => r.manager_id !== managerId)
    .reduce((acc: any, roster: any) => {
      const managerId = roster.manager_id;
      if (!acc[managerId]) {
        acc[managerId] = {
          managerName: roster.managers?.nom || 'Inconnu',
          rosters: []
        };
      }
      acc[managerId].rosters.push(roster);
      return acc;
    }, {});

  // Filter by search term
  const filteredManagers = Object.entries(rostersByManager).filter(([_, data]: [string, any]) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    const managerMatch = data.managerName.toLowerCase().includes(searchLower);
    const coureurMatch = data.rosters.some((r: any) => 
      r.coureurs.nom.toLowerCase().includes(searchLower)
    );
    return managerMatch || coureurMatch;
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un manager ou coureur..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="outline">
          {filteredManagers.length} manager(s)
        </Badge>
      </div>

      {filteredManagers.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Aucune équipe trouvée
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredManagers.map(([managerId, data]: [string, any]) => (
            <Card key={managerId} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{data.managerName}</span>
                  <Badge variant="secondary">{data.rosters.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Coureurs:</span>
                  <Badge variant="outline">{data.rosters.length}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Dépensé:</span>
                  <span className="font-medium">
                    {formatAmount(data.rosters.reduce((sum: number, r: any) => 
                      sum + parseFloat(r.prix_signature.toString()), 0
                    ))}
                  </span>
                </div>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full">
                      Voir détails
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[500px] h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{data.managerName}</DialogTitle>
                    </DialogHeader>
                    <div className="mt-4 space-y-2">
                      {data.rosters
                        .sort((a: any, b: any) => parseFloat(b.prix_signature.toString()) - parseFloat(a.prix_signature.toString()))
                        .map((roster: any) => (
                          <div key={roster.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                            <div>
                              <p className="font-medium">{roster.coureurs.nom}</p>
                              <p className="text-sm text-muted-foreground">{roster.coureurs.equipe}</p>
                            </div>
                            <Badge variant="outline">
                              {formatAmount(roster.prix_signature)}
                            </Badge>
                          </div>
                        ))}
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
