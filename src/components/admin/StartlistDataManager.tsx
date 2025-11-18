import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search } from "lucide-react";
import { StartlistEntriesTable } from "./startlist-data/StartlistEntriesTable";
import { StartlistStats } from "./startlist-data/StartlistStats";
import { MissingTeamsSection } from "./startlist-data/MissingTeamsSection";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const StartlistDataManager = () => {
  const [filters, setFilters] = useState({
    status: 'all',
    startlist_id: '',
    source_name: '',
    unmatchedOnly: false,
    saison_id: '',
  });

  const { data: saisons, isLoading: loadingSaisons } = useQuery({
    queryKey: ['saisons-for-startlist'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saisons')
        .select('id, annee')
        .order('annee', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: entries, isLoading: loadingEntries, refetch } = useQuery({
    queryKey: ['startlist-entries', filters],
    queryFn: async () => {
      let query = supabase
        .from('startlist_entries')
        .select(`
          *,
          coureurs(nom, equipe),
          startlist_imports!inner(
            race_id,
            courses(nom, phase_id, phases(saison_id))
          )
        `);

      if (filters.status !== 'all' && filters.status) {
        query = query.eq('status', filters.status as 'parsed' | 'confirmed' | 'unmatched');
      }
      if (filters.startlist_id) {
        query = query.eq('startlist_id', filters.startlist_id);
      }
      if (filters.source_name) {
        query = query.ilike('source_name', `%${filters.source_name}%`);
      }
      if (filters.unmatchedOnly) {
        query = query.is('coureur_id', null);
      }
      if (filters.saison_id) {
        query = query.eq('startlist_imports.courses.phases.saison_id', filters.saison_id);
      }

      const { data, error } = await query.order('source_name');
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestion des données Startlist</h1>
          <p className="text-muted-foreground">Gérer les coureurs non matchés et créer les entités manquantes</p>
        </div>
      </div>

      <StartlistStats entries={entries || []} saisonId={filters.saison_id} />

      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Saison</Label>
              <Select
                value={filters.saison_id}
                onValueChange={(value) => setFilters({ ...filters, saison_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Toutes les saisons" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Toutes</SelectItem>
                  {saisons?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.annee}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Statut</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => setFilters({ ...filters, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="parsed">Parsé</SelectItem>
                  <SelectItem value="confirmed">Confirmé</SelectItem>
                  <SelectItem value="unmatched">Non matché</SelectItem>
                  <SelectItem value="off_roster">Hors effectif</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Recherche par nom</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nom du coureur..."
                  value={filters.source_name}
                  onChange={(e) => setFilters({ ...filters, source_name: e.target.value })}
                  className="pl-8"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="unmatched-only"
              checked={filters.unmatchedOnly}
              onCheckedChange={(checked) => setFilters({ ...filters, unmatchedOnly: checked })}
            />
            <Label htmlFor="unmatched-only">Afficher uniquement les non matchés</Label>
          </div>

          <Button variant="outline" onClick={() => refetch()}>
            <Loader2 className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </CardContent>
      </Card>

      {filters.saison_id && (
        <MissingTeamsSection saisonId={filters.saison_id} onTeamCreated={refetch} />
      )}

      {loadingEntries ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <StartlistEntriesTable
          entries={entries || []}
          saisonId={filters.saison_id}
          onUpdate={refetch}
        />
      )}
    </div>
  );
};
