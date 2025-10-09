import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, TrendingDown, Trophy, ArrowUpDown, X, Shirt } from "lucide-react";
import { useManagerSponsor } from "@/hooks/useManagerSponsor";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RiderPointsDetail } from "./RiderPointsDetail";
import { useSeasonContext } from "@/contexts/SeasonContext";

interface Coureur {
  coureur_id: string;
  nom: string;
  equipe: string;
  prix_achat: number;
  cote_initiale: number;
  points_total: number;
  ratio_points_par_prix: number;
}

interface PointDetail {
  course_nom: string;
  type_classement: string;
  etape_numero: number | null;
  points: number;
  date_classement: string;
  total_points: number;
}

interface TeamKPIs {
  scorers_count: number;
  total_points: number;
  bonus_points: number;
  total_with_bonus: number;
  wins_count: number;
  my_rank: number | null;
  managers_count: number;
}


type SortBy = 'points' | 'ratio' | 'prix' | 'cote';

interface Manager {
  id: string;
  nom: string;
}

export const MyTeamDesktop = () => {
  const { toast } = useToast();
  const { phases, activePhase, selectedSeason } = useSeasonContext();
  const [coureurs, setCoureurs] = useState<Coureur[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortBy>('points');
  const [kpis, setKpis] = useState<TeamKPIs>({
    scorers_count: 0,
    total_points: 0,
    bonus_points: 0,
    total_with_bonus: 0,
    wins_count: 0,
    my_rank: null,
    managers_count: 0
  });
  
  // Phase state
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  
  // Manager selection state
  const [managers, setManagers] = useState<Manager[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Rider detail state
  const [selectedRider, setSelectedRider] = useState<{ id: string; nom: string; equipe: string; prix: number } | null>(null);

  // Desktop version

  useEffect(() => {
    loadManagers();
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (activePhase) {
      setSelectedPhaseId(activePhase.id);
    }
  }, [activePhase]);

  useEffect(() => {
    if (selectedPhaseId) {
      loadTeam();
    }
  }, [selectedPhaseId, selectedManagerId]);

  const loadCurrentUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: manager } = await supabase
        .from('managers')
        .select('id')
        .eq('user_id', session.user.id)
        .single();
        
      if (manager) {
        setCurrentUserId(manager.id);
      }
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  };

  const loadManagers = async () => {
    try {
      const { data: managersData } = await supabase
        .from('managers')
        .select('id, nom')
        .order('nom', { ascending: true });
      
      setManagers(managersData || []);
    } catch (error) {
      console.error('Error loading managers:', error);
    }
  };


  const loadTeam = async () => {
    setLoading(true);
    try {
      // Récupérer la session pour obtenir le token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('No session found');
        toast({
          title: "Erreur d'authentification",
          description: "Vous devez être connecté pour voir votre équipe",
          variant: "destructive"
        });
        setCoureurs([]);
        setLoading(false);
        return;
      }

      // Appeler la fonction avec le token d'authentification
      const { data, error } = await supabase.functions.invoke('manager-my-team', {
        body: { 
          phase_id: selectedPhaseId,
          manager_id: selectedManagerId 
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;
      setCoureurs(data.coureurs || []);
      setKpis(data.kpis || { scorers_count: 0, total_points: 0, bonus_points: 0, total_with_bonus: 0, wins_count: 0, my_rank: null, managers_count: 0 });
    } catch (error) {
      console.error('Error loading team:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger votre équipe",
        variant: "destructive"
      });
      setCoureurs([]);
    } finally {
      setLoading(false);
    }
  };

  const openCoureurDetail = (coureur: Coureur) => {
    setSelectedRider({
      id: coureur.coureur_id,
      nom: coureur.nom,
      equipe: coureur.equipe,
      prix: coureur.prix_achat
    });
  };

  const sortedCoureurs = [...coureurs].sort((a, b) => {
    switch (sortBy) {
      case 'points':
        return b.points_total - a.points_total;
      case 'ratio':
        return b.ratio_points_par_prix - a.ratio_points_par_prix;
      case 'prix':
        return b.prix_achat - a.prix_achat;
      case 'cote':
        return b.cote_initiale - a.cote_initiale;
      default:
        return 0;
    }
  });

  const getRatioColor = (ratio: number) => {
    if (ratio > 10) return "text-green-800 dark:text-green-300";
    if (ratio >= 4 && ratio <= 10) return "text-green-600 dark:text-green-400";
    if (ratio >= 2 && ratio < 4) return "text-yellow-600 dark:text-yellow-400";
    if (ratio > 0 && ratio < 2) return "text-orange-600 dark:text-orange-400";
    if (ratio === 0) return "text-red-600 dark:text-red-400";
    return "text-muted-foreground";
  };

  const getRatioBgColor = (ratio: number) => {
    if (ratio > 10) return "bg-green-100 dark:bg-green-950/30 border-green-300 dark:border-green-800";
    if (ratio >= 4 && ratio <= 10) return "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900";
    if (ratio >= 2 && ratio < 4) return "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900";
    if (ratio > 0 && ratio < 2) return "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900";
    if (ratio === 0) return "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900";
    return "";
  };

  const getPhaseLabel = (phase: any) => {
    const debut = new Date(phase.date_debut).toLocaleDateString('fr-FR', { month: 'short' });
    const fin = new Date(phase.date_fin).toLocaleDateString('fr-FR', { month: 'short' });
    return `Phase ${phase.index_dans_saison} (${debut} - ${fin})${phase.statut === 'active' ? ' ✓' : ''}`;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mobile layout */}
      <div className="flex flex-col gap-4 md:hidden">
        <div>
          <h1 className="text-3xl font-bold">
            {selectedManagerId && selectedManagerId !== currentUserId
              ? managers.find(m => m.id === selectedManagerId)?.nom
              : 'Mon équipe'}
          </h1>
          <p className="text-muted-foreground">
            {coureurs.length} coureur{coureurs.length > 1 ? 's' : ''}
          </p>
        </div>
        
        {/* Manager selector - mobile */}
        {managers.length > 0 && (
          <Select value={selectedManagerId || '__MY_TEAM__'} onValueChange={(v) => setSelectedManagerId(v === '__MY_TEAM__' ? null : v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Mon équipe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__MY_TEAM__">Mon équipe</SelectItem>
              {managers.map((manager) => (
                <SelectItem key={manager.id} value={manager.id}>
                  {manager.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        
        {/* Phase selector - mobile */}
        {phases.length > 0 && (
          <Select value={selectedPhaseId || ''} onValueChange={setSelectedPhaseId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Sélectionner une phase" />
            </SelectTrigger>
            <SelectContent>
              {phases.map((phase) => (
                <SelectItem key={phase.id} value={phase.id}>
                  {getPhaseLabel(phase)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        
        {/* Sort buttons - mobile */}
        <div className="flex gap-2 overflow-x-auto">
          <Button
            variant={sortBy === 'points' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('points')}
          >
            <Trophy className="h-4 w-4 mr-2" />
            Points
          </Button>
          <Button
            variant={sortBy === 'ratio' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('ratio')}
          >
            <ArrowUpDown className="h-4 w-4 mr-2" />
            Ratio
          </Button>
          <Button
            variant={sortBy === 'prix' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('prix')}
          >
            Prix
          </Button>
          <Button
            variant={sortBy === 'cote' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('cote')}
          >
            Cote
          </Button>
        </div>
      </div>

      {/* Desktop layout */}
      <div className="hidden md:flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">
            {selectedManagerId && selectedManagerId !== currentUserId
              ? managers.find(m => m.id === selectedManagerId)?.nom
              : 'Mon équipe'}
          </h1>
          <p className="text-muted-foreground">
            {coureurs.length} coureur{coureurs.length > 1 ? 's' : ''}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Manager selector - desktop */}
          {managers.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Manager:</span>
              <Select value={selectedManagerId || '__MY_TEAM__'} onValueChange={(v) => setSelectedManagerId(v === '__MY_TEAM__' ? null : v)}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Mon équipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__MY_TEAM__">Mon équipe</SelectItem>
                  {managers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {/* Phase selector - desktop */}
          {phases.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Phase:</span>
              <Select value={selectedPhaseId || ''} onValueChange={setSelectedPhaseId}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Sélectionner une phase" />
                </SelectTrigger>
                <SelectContent>
                  {phases.map((phase) => (
                    <SelectItem key={phase.id} value={phase.id}>
                      {getPhaseLabel(phase)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {/* Sort buttons - desktop */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Trier par:</span>
            <Button
              variant={sortBy === 'points' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortBy('points')}
            >
              <Trophy className="h-4 w-4 mr-2" />
              Points
            </Button>
            <Button
              variant={sortBy === 'ratio' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortBy('ratio')}
            >
              <ArrowUpDown className="h-4 w-4 mr-2" />
              Ratio
            </Button>
            <Button
              variant={sortBy === 'prix' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortBy('prix')}
            >
              Prix
            </Button>
            <Button
              variant={sortBy === 'cote' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortBy('cote')}
            >
              Cote initiale
            </Button>
          </div>
        </div>
      </div>

      {/* Bannière KPI */}
      {coureurs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center">
                <Trophy className="h-8 w-8 text-primary mb-2" />
                <div className="text-3xl font-bold">{kpis.scorers_count}</div>
                <div className="text-sm text-muted-foreground text-center">
                  Scoreur{kpis.scorers_count > 1 ? 's' : ''} 
                  {phases.find(p => p.id === selectedPhaseId)?.statut !== 'active' && (
                    <span className="ml-1">
                      (Phase {phases.find(p => p.id === selectedPhaseId)?.index_dans_saison})
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center">
                <TrendingUp className="h-8 w-8 text-green-600 mb-2" />
                <div className="text-3xl font-bold">{kpis.total_with_bonus}</div>
                <div className="text-sm text-muted-foreground text-center">
                  Points totaux
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center">
                <span className="text-2xl mb-2">🎁</span>
                <div className="text-3xl font-bold">{kpis.bonus_points}</div>
                <div className="text-sm text-muted-foreground text-center">
                  Points bonus
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center">
                <Trophy className="h-8 w-8 text-yellow-500 mb-2" />
                <div className="text-3xl font-bold">{kpis.wins_count}</div>
                <div className="text-sm text-muted-foreground text-center">
                  Course{kpis.wins_count > 1 ? 's' : ''} gagnée{kpis.wins_count > 1 ? 's' : ''}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center">
                <Trophy className="h-8 w-8 text-blue-600 mb-2" />
                <div className="text-3xl font-bold">
                  {kpis.my_rank ? (
                    <>
                      {kpis.my_rank}
                      <sup className="text-sm ml-0.5">
                        {kpis.my_rank === 1 ? 'er' : 'e'}
                      </sup>
                    </>
                  ) : '—'}
                </div>
                <div className="text-sm text-muted-foreground text-center">
                  {kpis.managers_count > 0 ? `sur ${kpis.managers_count} managers` : 'Classement'}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {coureurs.length === 0 ? (
        <Card className="p-12 text-center">
          <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Équipe vide</h3>
          <p className="text-muted-foreground">
            Votre équipe est vide pour cette phase
          </p>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Coureur</TableHead>
                  <TableHead>Équipe</TableHead>
                  <TableHead className="text-right">Prix d'achat</TableHead>
                  <TableHead className="text-right">Cote initiale</TableHead>
                  <TableHead className="text-right">Points totaux</TableHead>
                  <TableHead className="text-right">Ratio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCoureurs.map((coureur) => (
                  <TableRow 
                    key={coureur.coureur_id}
                    className={`cursor-pointer hover:bg-muted/50 ${getRatioBgColor(coureur.ratio_points_par_prix)}`}
                    onClick={() => openCoureurDetail(coureur)}
                  >
                    <TableCell className="font-medium">{coureur.nom}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {coureur.equipe}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {coureur.prix_achat.toFixed(0)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {coureur.cote_initiale.toFixed(0)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Trophy className="h-4 w-4 text-primary" />
                        <span className="font-bold text-lg">{coureur.points_total}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className={`flex items-center justify-end gap-1 font-semibold ${getRatioColor(coureur.ratio_points_par_prix)}`}>
                        {coureur.ratio_points_par_prix > 1 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : coureur.ratio_points_par_prix < 1 ? (
                          <TrendingDown className="h-4 w-4" />
                        ) : null}
                        <span>{coureur.ratio_points_par_prix.toFixed(2)}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile list - sans vignettes */}
          <div className="space-y-0 md:hidden divide-y">
            {sortedCoureurs.map((coureur) => (
              <div 
                key={coureur.coureur_id}
                className={`cursor-pointer hover:bg-muted/50 p-4 transition-colors ${getRatioBgColor(coureur.ratio_points_par_prix)}`}
                onClick={() => openCoureurDetail(coureur)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-medium text-base">{coureur.nom}</div>
                    <div className="text-sm text-muted-foreground mt-1">{coureur.equipe}</div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end mb-1">
                      <Trophy className="h-4 w-4 text-primary" />
                      <span className="font-bold text-lg">{coureur.points_total}</span>
                    </div>
                    <div className={`flex items-center gap-1 justify-end font-semibold text-sm ${getRatioColor(coureur.ratio_points_par_prix)}`}>
                      {coureur.ratio_points_par_prix > 1 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : coureur.ratio_points_par_prix < 1 ? (
                        <TrendingDown className="h-3 w-3" />
                      ) : null}
                      <span>{coureur.ratio_points_par_prix.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>Prix: <span className="font-semibold text-foreground">{coureur.prix_achat.toFixed(0)}</span></span>
                  <span>Cote: <span className="font-semibold text-foreground">{coureur.cote_initiale.toFixed(0)}</span></span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Rider Points Detail */}
      <RiderPointsDetail
        isOpen={!!selectedRider}
        onClose={() => setSelectedRider(null)}
        riderId={selectedRider?.id || ''}
        riderName={selectedRider?.nom || ''}
        riderTeam={selectedRider?.equipe || ''}
        riderPrice={selectedRider?.prix || 0}
        phaseId={selectedPhaseId || ''}
        managerId={selectedManagerId || currentUserId || undefined}
      />
    </div>
  );
};

const ManagerJerseyDisplay = () => {
  const { selectedSeason } = useSeasonContext();
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  
  // Get current user's manager_id
  useEffect(() => {
    const loadCurrentManager = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: manager } = await supabase
        .from('managers')
        .select('id')
        .eq('user_id', session.user.id)
        .single();
        
      if (manager) {
        setSelectedManagerId(manager.id);
      }
    };
    
    loadCurrentManager();
  }, []);
  
  const { data: sponsorData } = useManagerSponsor(selectedManagerId || undefined, selectedSeason?.id);
  
  if (!sponsorData?.jersey_image_url) {
    return <Shirt className="h-8 w-8 text-muted-foreground" />;
  }
  
  return (
    <img 
      src={sponsorData.jersey_image_url} 
      alt="Maillot" 
      className="h-10 w-10 object-contain rounded"
    />
  );
};

export default MyTeamDesktop;
