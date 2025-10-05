import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ListChecks, Users, FileDown, AlertCircle, Menu, LogOut } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export default function Startlist() {
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [selectedRaceId, setSelectedRaceId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [teamFilter, setTeamFilter] = useState("");

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  // Get current user's manager ID
  const { data: currentManager } = useQuery({
    queryKey: ['current-manager'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const { data } = await supabase
        .from('managers')
        .select('id')
        .eq('user_id', session.user.id)
        .single();
      
      return data;
    }
  });

  // Fetch races with startlists
  const { data: races, isLoading: racesLoading } = useQuery({
    queryKey: ['races-with-startlists'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('startlist_imports')
        .select(`
          id,
          race_id,
          created_at,
          courses!inner(
            id,
            nom,
            date_debut,
            categorie
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    }
  });

  // Fetch manager view for selected race
  const { data: managerView, isLoading: viewLoading } = useQuery({
    queryKey: ['startlist-manager-view', selectedRaceId],
    enabled: !!selectedRaceId,
    queryFn: async () => {
      const startlist = races?.find(r => r.race_id === selectedRaceId);
      if (!startlist) return null;

      const { data, error } = await supabase.functions.invoke('startlist-manager-view', {
        body: { startlist_id: startlist.id }
      });

      if (error) throw error;
      return data;
    }
  });

  const handleExportCSV = async () => {
    if (!selectedRaceId) return;
    
    const startlist = races?.find(r => r.race_id === selectedRaceId);
    if (!startlist) return;

    const { data, error } = await supabase.functions.invoke('startlist-export-csv', {
      body: { startlist_id: startlist.id }
    });

    if (error) {
      console.error('Export error:', error);
      return;
    }

    // Trigger download
    const blob = new Blob([data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `startlist_${selectedRaceId}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Filter managers
  const filteredManagers = managerView?.managers.filter(manager => {
    const hasSearchMatch = !searchTerm || 
      manager.starters.some(s => 
        s.nom.toLowerCase().includes(searchTerm.toLowerCase())
      );
    
    const hasTeamMatch = !teamFilter ||
      manager.starters.some(s => s.equipe === teamFilter);

    return hasSearchMatch && hasTeamMatch;
  });

  // Get unique teams for filter
  const teams = Array.from(new Set(
    managerView?.managers.flatMap(m => 
      m.starters.map(s => s.equipe).filter(Boolean)
    ) || []
  )).sort();

  // Sort managers: current user first, then by starter count
  const sortedManagers = filteredManagers?.sort((a, b) => {
    if (currentManager) {
      if (a.manager_id === currentManager.id) return -1;
      if (b.manager_id === currentManager.id) return 1;
    }
    return b.starters_count - a.starters_count;
  });

  if (roleLoading || !currentManager) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4">
            <Skeleton className="h-8 w-32" />
          </div>
        </header>
        <div className="container mx-auto p-6">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!isAdmin && !currentManager) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-xl font-bold">Startlist</h1>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>
        <div className="container mx-auto p-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Vous devez être manager ou administrateur pour accéder à cette page.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <nav className="flex flex-col gap-4 mt-8">
                  <Button variant="ghost" onClick={() => navigate("/")}>Accueil</Button>
                  <Button variant="ghost" onClick={() => navigate("/dashboard")}>Équipe</Button>
                  <Button variant="ghost" onClick={() => navigate("/dashboard/courses")}>Courses</Button>
                  <Button variant="ghost" onClick={() => navigate("/rankings")}>Classement</Button>
                  <Button variant="default">Startlist</Button>
                  <Button variant="ghost" onClick={() => navigate("/results")}>Résultats</Button>
                  {isAdmin && <Button variant="ghost" onClick={() => navigate("/admin")}>Admin</Button>}
                </nav>
              </SheetContent>
            </Sheet>
            <ListChecks className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Startlist</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>
      
      <div className="container mx-auto p-6 space-y-6">

        {/* Race selector */}
        <Card>
          <CardHeader>
            <CardTitle>Sélectionner une course</CardTitle>
            <CardDescription>
              Choisissez une course pour voir les équipes au départ
            </CardDescription>
          </CardHeader>
          <CardContent>
            {racesLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select value={selectedRaceId} onValueChange={setSelectedRaceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une course..." />
                </SelectTrigger>
                <SelectContent>
                  {races?.map((race: any) => (
                    <SelectItem key={String(race.race_id)} value={String(race.race_id)}>
                      {String(race.courses.nom)} ({new Date(race.courses.date_debut).toLocaleDateString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        {/* Manager view */}
        {selectedRaceId && (
          <>
            {viewLoading ? (
              <Skeleton className="h-96" />
            ) : managerView ? (
              <>
                {/* Summary and filters */}
                <div className="flex flex-wrap gap-4 items-center justify-between">
                  <div className="flex gap-2">
                    <Badge variant="outline">
                      <Users className="h-3 w-3 mr-1" />
                      {managerView.totals.managers} managers
                    </Badge>
                    <Badge variant="outline">
                      <ListChecks className="h-3 w-3 mr-1" />
                      {managerView.totals.starters_all} coureurs
                    </Badge>
                  </div>
                  
                  <div className="flex gap-2 flex-1 max-w-2xl">
                    <Input
                      placeholder="Rechercher un coureur..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="flex-1"
                    />
                    <Select value={teamFilter} onValueChange={setTeamFilter}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Filtrer par équipe" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Toutes les équipes</SelectItem>
                        {teams.map(team => (
                          <SelectItem key={String(team)} value={String(team)}>{String(team)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button onClick={handleExportCSV} variant="outline">
                    <FileDown className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>

                {/* Manager cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sortedManagers?.map((manager: any) => (
                    <Card key={String(manager.manager_id)} className={
                      currentManager?.id === manager.manager_id 
                        ? "border-primary shadow-lg" 
                        : ""
                    }>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{String(manager.manager_nom)}</CardTitle>
                          {currentManager?.id === manager.manager_id && (
                            <Badge variant="default">Mon équipe</Badge>
                          )}
                        </div>
                        <CardDescription>
                          {manager.starters_count} coureur{manager.starters_count > 1 ? 's' : ''} au départ
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-1 max-h-96 overflow-y-auto">
                          {manager.starters.map((starter: any) => (
                            <div 
                              key={String(starter.coureur_id)}
                              className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-muted/50"
                            >
                              <div className="flex-1">
                                <div className="font-medium">{String(starter.nom)}</div>
                                {starter.equipe && (
                                  <div className="text-xs text-muted-foreground">{String(starter.equipe)}</div>
                                )}
                              </div>
                              {starter.bib_no && (
                                <Badge variant="outline" className="ml-2">
                                  #{starter.bib_no}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Aucune donnée de startlist disponible pour cette course.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </div>
    </div>
  );
}
