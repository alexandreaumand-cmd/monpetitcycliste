import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type Row = {
  id: string;
  coureur_id: string;
  rider_name_pcs: string;
  injury: string;
  injury_context: string | null;
  injury_date: string;
  weeks_out: number;
  estimated_return_date: string;
  last_seen_at: string;
  coureur?: { nom: string; equipe: string | null } | null;
};

export default function SuperAdminInjuriesPage() {
  const qc = useQueryClient();
  const [showHistory, setShowHistory] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-rider-injuries", showHistory],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      let q = supabase
        .from("rider_injuries")
        .select(
          "id, coureur_id, rider_name_pcs, injury, injury_context, injury_date, weeks_out, estimated_return_date, last_seen_at, coureur:coureurs(nom, equipe)",
        )
        .order("injury_date", { ascending: false });
      if (!showHistory) q = q.gte("estimated_return_date", today);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const scrapeMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("scrape-rider-injuries", {
        body: {},
      });
      if (error) throw error;
      return data as {
        scraped: number;
        matched: number;
        upserted: number;
        skipped_count: number;
      };
    },
    onSuccess: (r) => {
      toast({
        title: "Scraping terminé",
        description: `${r.scraped} blessures trouvées · ${r.matched} coureurs reconnus · ${r.upserted} enregistrés · ${r.skipped_count} ignorés`,
      });
      qc.invalidateQueries({ queryKey: ["admin-rider-injuries"] });
      qc.invalidateQueries({ queryKey: ["active-rider-injuries"] });
    },
    onError: (e: unknown) => {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rider_injuries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Blessure supprimée" });
      qc.invalidateQueries({ queryKey: ["admin-rider-injuries"] });
      qc.invalidateQueries({ queryKey: ["active-rider-injuries"] });
    },
  });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">🤕 Blessés</h1>
          <p className="text-sm text-muted-foreground">
            Données issues de procyclingstats.com — scraping quotidien à 21h.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={showHistory} onCheckedChange={setShowHistory} />
            Afficher l'historique
          </label>
          <Button
            onClick={() => scrapeMut.mutate()}
            disabled={scrapeMut.isPending}
          >
            {scrapeMut.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Scraper maintenant
          </Button>
        </div>
      </div>

      <Card>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Chargement…
          </div>
        ) : !data || data.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Aucune blessure {showHistory ? "" : "active"} enregistrée.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Coureur</TableHead>
                <TableHead>Équipe</TableHead>
                <TableHead>Blessure</TableHead>
                <TableHead>Contexte</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-center">Semaines</TableHead>
                <TableHead>Retour estimé</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => {
                const active = r.estimated_return_date >= today;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.coureur?.nom ?? r.rider_name_pcs}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.coureur?.equipe ?? "—"}
                    </TableCell>
                    <TableCell>{r.injury}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {r.injury_context}
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(r.injury_date), "d MMM yyyy", { locale: fr })}
                    </TableCell>
                    <TableCell className="text-center">{r.weeks_out}</TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(r.estimated_return_date), "d MMM yyyy", {
                        locale: fr,
                      })}
                    </TableCell>
                    <TableCell>
                      {active ? (
                        <Badge variant="destructive">Actif</Badge>
                      ) : (
                        <Badge variant="secondary">Terminé</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Supprimer cette blessure ?")) {
                            deleteMut.mutate(r.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
