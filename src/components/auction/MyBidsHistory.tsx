import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface MyBidsHistoryProps {
  managerId: string;
}

export const MyBidsHistory = ({ managerId }: MyBidsHistoryProps) => {
  const { data: bids, isLoading } = useQuery({
    queryKey: ['my-bids-history', managerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bids')
        .select(`
          *,
          coureurs(nom, equipe, prix_initial),
          auctions(round_number, deadline_at, statut)
        `)
        .eq('manager_id', managerId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!bids || bids.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Historique des Enchères</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Vous n'avez pas encore participé à des enchères
          </p>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (statut: string) => {
    switch (statut) {
      case 'won':
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Gagné</Badge>;
      case 'lost':
        return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Perdu</Badge>;
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />En attente</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historique de Mes Enchères</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tour</TableHead>
              <TableHead>Coureur</TableHead>
              <TableHead>Équipe</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bids.map((bid) => (
              <TableRow key={bid.id}>
                <TableCell>Tour {bid.auctions.round_number}</TableCell>
                <TableCell className="font-medium">{bid.coureurs.nom}</TableCell>
                <TableCell className="text-muted-foreground">{bid.coureurs.equipe}</TableCell>
                <TableCell>{parseFloat(bid.montant.toString()).toFixed(0)} €</TableCell>
                <TableCell>{getStatusBadge(bid.statut)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
