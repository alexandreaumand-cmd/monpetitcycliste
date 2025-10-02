import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface MyTeamProps {
  managerId: string;
}

export const MyTeam = ({ managerId }: MyTeamProps) => {
  const { data: activePhase } = useQuery({
    queryKey: ['active-phase'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phases')
        .select('*')
        .eq('statut', 'active')
        .maybeSingle();
      
      if (error) throw error;
      return data;
    }
  });

  const { data: roster, isLoading } = useQuery({
    queryKey: ['my-roster', managerId, activePhase?.id],
    queryFn: async () => {
      if (!activePhase) return [];
      
      const { data, error } = await supabase
        .from('rosters')
        .select(`
          *,
          coureurs(nom, equipe, prix_initial)
        `)
        .eq('manager_id', managerId)
        .eq('phase_id', activePhase.id)
        .order('prix_signature', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!activePhase
  });

  const { data: budget } = useQuery({
    queryKey: ['team-budget', managerId, activePhase?.id],
    queryFn: async () => {
      if (!activePhase) return null;
      
      const spent = roster?.reduce((sum, r) => sum + parseFloat(r.prix_signature.toString()), 0) || 0;
      const remaining = parseFloat(activePhase.budget.toString()) - spent;
      
      return {
        total: parseFloat(activePhase.budget.toString()),
        spent,
        remaining
      };
    },
    enabled: !!activePhase && !!roster
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!activePhase) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Mon Équipe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Aucune phase active pour le moment
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!roster || roster.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Mon Équipe
            </div>
            <Badge variant="outline">0 / {activePhase.max_coureurs} coureurs</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Vous n'avez pas encore de coureurs. Participez aux enchères !
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Mon Équipe
          </div>
          <div className="flex gap-2">
            <Badge variant="outline">{roster.length} / {activePhase.max_coureurs} coureurs</Badge>
            <Badge className="bg-green-500">
              {budget?.remaining.toFixed(0)} € restants
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Budget Total</p>
              <p className="text-lg font-bold">{budget?.total.toFixed(0)} €</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Dépensé</p>
              <p className="text-lg font-bold">{budget?.spent.toFixed(0)} €</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Restant</p>
              <p className="text-lg font-bold text-green-600">{budget?.remaining.toFixed(0)} €</p>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Coureur</TableHead>
                <TableHead>Équipe</TableHead>
                <TableHead className="text-right">Prix Payé</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roster.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.coureurs.nom}</TableCell>
                  <TableCell className="text-muted-foreground">{r.coureurs.equipe}</TableCell>
                  <TableCell className="text-right">
                    {parseFloat(r.prix_signature.toString()).toFixed(0)} €
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
