import { useState, useEffect } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Search, ChevronDown, ChevronRight, Share2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { StageJerseyBonuses } from "./StageJerseyBonuses";
import { useLeague } from "@/contexts/LeagueContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { ExportResultsImage } from "@/components/admin/ExportResultsImage";
import { TTTResultsTable } from "./TTTResultsTable";

// Jersey holders compact bar component
const JerseyHoldersBar = ({ courseId, etapeNumero, leagueId }: { courseId: string | null; etapeNumero: number | null; leagueId: string | null }) => {
  const { data: holders, isLoading } = useQuery({
    queryKey: ["jersey-holders", courseId, etapeNumero, leagueId],
    queryFn: async () => {
      if (!courseId || !etapeNumero) return null;
      
      const jerseyTypes = [
        { type: 'Porteur Leader', icon: '🟡', label: 'Jaune' },
        { type: 'Porteur Vert', icon: '🟢', label: 'Vert' },
        { type: 'Porteur Montagne', icon: '🔴', label: 'Pois' },
        { type: 'Porteur Jeune', icon: '⚪', label: 'Blanc' },
        { type: 'Porteur Combattif', icon: '🔵', label: 'Combattif' }
      ];
      
      const results = await Promise.all(
        jerseyTypes.map(async (jersey) => {
          const { data } = await supabase.functions.invoke('results-course-table', {
            body: {
              course_id: courseId,
              type_classement: jersey.type,
              etape_numero: etapeNumero,
              league_id: leagueId
            }
          });
          
          const holder = data?.rows?.[0];
          return holder ? {
            ...jersey,
            coureur_id: holder.coureur_id,
            coureur_nom: holder.coureur_nom,
            equipe: holder.equipe,
            manager_nom: holder.manager_nom
          } : null;
        })
      );
      
      return results.filter(Boolean);
    },
    enabled: !!courseId && !!etapeNumero,
  });

  if (isLoading) {
    return <Skeleton className="h-12 w-full rounded-lg" />;
  }

  if (!holders || holders.length === 0) {
    return null;
  }

  return (
    <div className="bg-muted/30 rounded-lg p-2 border space-y-1.5">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
        Maillots
      </span>
      <div className="space-y-1">
        {holders.map((holder: any, idx: number) => (
          <div key={idx} className="flex items-center gap-1.5 text-xs">
            <span className="text-sm w-5 flex-shrink-0">{holder.icon}</span>
            <span className="font-medium truncate flex-1">{holder.coureur_nom}</span>
            <span className="text-[10px] text-muted-foreground truncate max-w-[70px]">
              ({holder.equipe})
            </span>
            {holder.manager_nom && (
              <span className="text-[10px] text-muted-foreground flex-shrink-0">
                {holder.manager_nom}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

interface CourseMeta {
  course_nom: string;
  categorie: string;
  date_debut: string;
  date_fin: string;
  types_disponibles: string[];
  etapes_disponibles: number[];
}

interface ResultRow {
  race_result_id: string;
  row_position: number | null;
  position_decimal: number | null;
  statut: string;
  coureur_id: string;
  coureur_nom: string;
  equipe: string;
  equipe_id_uci?: string | null;
  equipe_nom_uci?: string | null;
  manager_id: string | null;
  manager_nom: string | null;
  points_officiels: number | null;
  points_theoriques: number;
  is_my_rider: boolean;
  isTeamHeader?: boolean;
}

interface TotalRider {
  coureur_id: string;
  coureur_nom: string;
  equipe: string;
  manager_nom: string | null;
  total_points: number;
  rank: number;
}

interface CourseResultsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string | null;
}

export const CourseResultsDrawer = ({ open, onOpenChange, courseId }: CourseResultsDrawerProps) => {
  const { leagueId } = useLeague();
  const isMobile = useIsMobile();
  const [meta, setMeta] = useState<CourseMeta | null>(null);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedEtape, setSelectedEtape] = useState<number | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("results");
  const [expandedManagers, setExpandedManagers] = useState<Set<string>>(new Set());
  const [expandedRiders, setExpandedRiders] = useState<Set<string>>(new Set());
  const [totalRiders, setTotalRiders] = useState<any[]>([]);
  const [totalBreakdown, setTotalBreakdown] = useState<any[]>([]);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [isTTT, setIsTTT] = useState(false);
  const { toast } = useToast();

  // Fetch league name for export
  const { data: leagueInfo } = useQuery({
    queryKey: ["league-info", leagueId],
    queryFn: async () => {
      if (!leagueId) return null;
      const { data } = await supabase
        .from("leagues")
        .select("name")
        .eq("id", leagueId)
        .maybeSingle();
      return data;
    },
    enabled: !!leagueId,
    staleTime: 1000 * 60 * 30,
  });

  // Fetch course phase_id for export
  const { data: courseDetails } = useQuery({
    queryKey: ["course-details-phase", courseId],
    queryFn: async () => {
      if (!courseId) return null;
      const { data } = await supabase
        .from("courses")
        .select("phase_id")
        .eq("id", courseId)
        .maybeSingle();
      return data;
    },
    enabled: !!courseId,
    staleTime: 1000 * 60 * 30,
  });

  // Fetch leaderboard for the course - always consolidated (all stages, all classifications)
  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery({
    queryKey: ["course-leaderboard-drawer", courseId, leagueId],
    queryFn: async () => {
      if (!courseId) return null;
      const { data, error } = await supabase.functions.invoke("course-leaderboard", {
        body: {
          course_id: courseId,
          type_classement: null,  // Always aggregate all classification types
          etape_numero: null,     // Always aggregate all stages
          league_id: leagueId
        }
      });
      if (error) throw error;
      return data as {
        course: { id: string; nom: string; date_debut: string; category: string };
        leaderboard: Array<{ rank: number; manager_id: string; manager_nom: string; points: number }>;
        contributors: Array<{ 
          manager_id: string; 
          rider_id: string; 
          rider_nom: string; 
          type_classement: string; 
          etape_numero: number | null; 
          points: number 
        }>;
      };
    },
    enabled: open && !!courseId && activeTab === "leaderboard",
  });

  useEffect(() => {
    if (open && courseId) {
      loadMeta();
    }
  }, [open, courseId]);

  useEffect(() => {
    if (meta && selectedType) {
      if (selectedType === 'Total') {
        loadTotalResults();
      } else {
        loadResults();
      }
    }
  }, [selectedType, selectedEtape, meta]);

  const loadMeta = async () => {
    if (!courseId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('results-course-meta-v2', {
        body: { course_id: courseId }
      });

      if (error) throw error;

      if (data?.meta) {
        setMeta(data.meta);
        
        // Filter out "Porteur *" types
        const types = (data.meta.types_disponibles || [])
          .filter((type: string) => !type.startsWith('Porteur'));
        
        // Detect if this is a stage race
        const isStageRace = data.meta.etapes_disponibles?.length > 0;
        
        // Check if General results actually exist in the available types
        const hasGeneralResults = types.includes('General');
        
        if (isStageRace) {
          if (hasGeneralResults) {
            // For stage races with General results: show finals tab with General
            setActiveTab('finals');
            setSelectedType('General');
            setSelectedEtape(null);
          } else {
            // No General yet: show stages tab with latest stage
            setActiveTab('stages');
            setSelectedType('Etape');
            const latestEtape = Math.max(...(data.meta.etapes_disponibles || [1]));
            setSelectedEtape(latestEtape);
          }
        } else {
          // For simple races: start on "results" tab
          setActiveTab('results');
          const defaultType = hasGeneralResults ? 'General' : types[0];
          setSelectedType(defaultType);
        }
      }
    } catch (error) {
      console.error('Error loading course meta:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadResults = async () => {
    if (!courseId || !selectedType) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('results-course-table', {
        body: {
          course_id: courseId,
          type_classement: selectedType,
          etape_numero: selectedType === 'Etape' ? selectedEtape : null,
          league_id: leagueId
        }
      });

      if (error) throw error;

      const rows = data?.rows || [];
      
      // Check if this is a TTT (has position_decimal) - works for both Etape and General (one-day)
      const isTTTResult = (selectedType === 'Etape' || selectedType === 'General') && rows.some((r: any) => r.position_decimal !== null);
      setIsTTT(isTTTResult);
      
      // For TTT, just pass the raw rows - the TTTResultsTable component handles grouping
      setResults(rows);
    } catch (error) {
      console.error('Error loading results:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const loadTotalResults = async () => {
    if (!courseId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('rider-course-total', {
        body: { 
          course_id: courseId,
          league_id: leagueId
        }
      });

      if (error) throw error;

      setTotalRiders(data?.riders || []);
      setTotalBreakdown(data?.breakdown || []);
    } catch (error) {
      console.error('Error loading total results:', error);
      setTotalRiders([]);
      setTotalBreakdown([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    if (type === 'Etape' && meta?.etapes_disponibles?.length) {
      setSelectedEtape(meta.etapes_disponibles[meta.etapes_disponibles.length - 1]);
    } else {
      setSelectedEtape(null);
    }
  };


  // Split finished (with points) and non-finished
  const finishedResults = results
    .filter(r => {
      if (r.statut !== 'finished' || r.row_position === null) return false;
      const points = (r.points_officiels !== null && r.points_officiels > 0) 
        ? r.points_officiels 
        : r.points_theoriques;
      return points > 0;
    });
  
  const nonFinishedResults = results
    .filter(r => r.statut !== 'finished' || r.row_position === null);

  const displayedResults = [...finishedResults, ...nonFinishedResults];

  const getStatutBadge = (statut: string) => {
    const variants: Record<string, { label: string; variant: "destructive" | "secondary" | "outline" }> = {
      dnf: { label: "DNF", variant: "destructive" },
      dns: { label: "DNS", variant: "secondary" },
      dsq: { label: "DSQ", variant: "outline" }
    };
    return variants[statut.toLowerCase()] || null;
  };

  const toggleManager = (managerId: string) => {
    const newExpanded = new Set(expandedManagers);
    if (newExpanded.has(managerId)) {
      newExpanded.delete(managerId);
    } else {
      newExpanded.add(managerId);
    }
    setExpandedManagers(newExpanded);
  };

  const toggleRider = (riderId: string) => {
    const newExpanded = new Set(expandedRiders);
    if (newExpanded.has(riderId)) {
      newExpanded.delete(riderId);
    } else {
      newExpanded.add(riderId);
    }
    setExpandedRiders(newExpanded);
  };

  const getContributorsForManager = (managerId: string) => {
    if (!leaderboard) return [];
    return leaderboard.contributors
      .filter(c => c.manager_id === managerId)
      .sort((a, b) => b.points - a.points);
  };

  const getRiderBreakdown = (riderId: string) => {
    return totalBreakdown
      .filter(b => b.coureur_id === riderId)
      .sort((a, b) => b.points - a.points);
  };

  const formatClassementLabel = (typeClassement: string, etapeNumero: number | null) => {
    switch (typeClassement) {
      case 'General':
        return 'Classement Général';
      case 'Etape':
        return `Étape ${etapeNumero}`;
      case 'Points':
        return 'Maillot Vert';
      case 'Montagne':
        return 'Maillot à Pois';
      case 'Jeune':
        return 'Maillot Blanc';
      case 'Combatif':
        return 'Super Combatif';
      default:
        return typeClassement;
    }
  };

  // Share button component
  const shareButton = meta && courseId && (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setExportDialogOpen(true)}
      className="h-8 w-8 flex-shrink-0"
    >
      <Share2 className="h-4 w-4" />
    </Button>
  );

  // Header content - shared between Dialog and Drawer
  const headerContent = meta ? (
    <div className="flex flex-col items-start gap-1 flex-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xl font-bold">{meta.course_nom}</span>
        <Badge variant="outline">{meta.categorie}</Badge>
        {selectedType === 'Etape' && results.some((r: any) => r.position_decimal !== null && !r.isTeamHeader) && (
          <Badge variant="secondary" className="bg-blue-500 text-white">
            TTT
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground font-normal">
        <Calendar className="h-4 w-4" />
        {meta.date_debut && format(new Date(meta.date_debut), 'dd MMM', { locale: fr })}
        {meta.date_fin && meta.date_fin !== meta.date_debut && (
          <> - {format(new Date(meta.date_fin), 'dd MMM yyyy', { locale: fr })}</>
        )}
      </div>
    </div>
  ) : (
    <Skeleton className="h-6 w-64" />
  );

  // Body content - shared between Dialog and Drawer
  const bodyContent = (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Conditional tabs based on race type */}
            {meta?.etapes_disponibles && meta.etapes_disponibles.length > 0 ? (
              // Stage race: 3 tabs - shorter labels for mobile
              <TabsList className="grid w-full grid-cols-3 h-auto p-1">
                <TabsTrigger value="finals" className="text-xs px-2 py-2 whitespace-nowrap">
                  Finaux
                </TabsTrigger>
                <TabsTrigger value="stages" className="text-xs px-2 py-2 whitespace-nowrap">
                  Étapes
                </TabsTrigger>
                <TabsTrigger value="leaderboard" className="text-xs px-2 py-2 whitespace-nowrap">
                  Managers
                </TabsTrigger>
              </TabsList>
            ) : (
              // Simple race: 2 tabs
              <TabsList className="grid w-full grid-cols-2 h-auto p-1">
                <TabsTrigger value="results" className="text-sm px-3 py-2">
                  Résultats
                </TabsTrigger>
                <TabsTrigger value="leaderboard" className="text-sm px-3 py-2">
                  Managers
                </TabsTrigger>
              </TabsList>
            )}

            {/* Tab: Classements Finaux (for stage races only) */}
            <TabsContent value="finals" className="space-y-4 mt-4">
              <div className="space-y-4">
                {/* Dropdown for final classifications */}
                <Select value={selectedType} onValueChange={handleTypeChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sélectionner un classement" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="General">Général</SelectItem>
                    {meta?.types_disponibles?.includes('Points') && (
                      <SelectItem value="Points">Points (Vert)</SelectItem>
                    )}
                    {meta?.types_disponibles?.includes('Montagne') && (
                      <SelectItem value="Montagne">Montagne (Pois)</SelectItem>
                    )}
                    {meta?.types_disponibles?.includes('Jeune') && (
                      <SelectItem value="Jeune">Jeune (Blanc)</SelectItem>
                    )}
                  </SelectContent>
                </Select>

                {/* Results display */}
                {loading ? (
                  <Skeleton className="h-96 w-full" />
                ) : displayedResults.length > 0 ? (
                  selectedType === 'Total' ? (
                    // Total riders table
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12"></TableHead>
                            <TableHead>Coureur</TableHead>
                            <TableHead className="hidden md:table-cell">Manager</TableHead>
                            <TableHead className="hidden lg:table-cell">Équipe</TableHead>
                            <TableHead className="text-right">Points</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {totalRiders.map((rider) => {
                            const breakdown = getRiderBreakdown(rider.coureur_id);
                            const isExpanded = expandedRiders.has(rider.coureur_id);
                            
                            return (
                              <Collapsible 
                                key={rider.coureur_id} 
                                asChild 
                                open={isExpanded}
                                onOpenChange={() => toggleRider(rider.coureur_id)}
                              >
                                <>
                                  <CollapsibleTrigger asChild>
                                    <TableRow className="cursor-pointer hover:bg-muted/50 touch-manipulation">
                                      <TableCell>
                                        {isExpanded ? (
                                          <ChevronDown className="h-4 w-4" />
                                        ) : (
                                          <ChevronRight className="h-4 w-4" />
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          <span className="text-lg">
                                            {rider.rank === 1 && '🥇'}
                                            {rider.rank === 2 && '🥈'}
                                            {rider.rank === 3 && '🥉'}
                                          </span>
                                          <div className="flex flex-col">
                                            <span className="font-semibold">{rider.coureur_nom}</span>
                                            <span className="text-xs text-muted-foreground md:hidden">
                                              {rider.manager_nom && `${rider.manager_nom} • `}{rider.equipe}
                                            </span>
                                          </div>
                                        </div>
                                      </TableCell>
                                      <TableCell className="hidden md:table-cell">
                                        {rider.manager_nom && (
                                          <Badge variant="secondary" className="text-xs">
                                            {rider.manager_nom}
                                          </Badge>
                                        )}
                                      </TableCell>
                                      <TableCell className="hidden lg:table-cell">
                                        {rider.equipe && (
                                          <Badge variant="outline" className="text-xs">
                                            {rider.equipe}
                                          </Badge>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-right font-bold">
                                        {Math.round(rider.total_points)}
                                      </TableCell>
                                    </TableRow>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent asChild>
                                    <TableRow className="bg-muted/20">
                                      <TableCell colSpan={5}>
                                        <div className="p-2 space-y-1 text-sm">
                                          {breakdown.map((item, idx) => (
                                            <div key={idx} className="flex justify-between">
                                              <span className="text-muted-foreground">
                                                {item.type_classement} {item.etape_numero && `(Étape ${item.etape_numero})`}
                                              </span>
                                              <span className="font-semibold">{Math.round(item.points)} pts</span>
                                            </div>
                                          ))}
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  </CollapsibleContent>
                                </>
                              </Collapsible>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : isTTT ? (
                    // TTT results with accordion
                    <TTTResultsTable results={displayedResults} compact={true} />
                  ) : (
                    // Regular results table - optimized for mobile with 4 columns
                    <div className="border rounded-lg overflow-hidden">
                      <Table className="text-[11px] table-fixed w-full">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-7 px-1 text-center">#</TableHead>
                            <TableHead className="px-1">Coureur</TableHead>
                            <TableHead className="text-right px-1 w-8">Pts</TableHead>
                            <TableHead className="px-1 w-16 text-right">Manager</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {displayedResults.map((row) => {
                            const isFinished = row.statut === 'finished' && row.row_position !== null;
                            const statutBadge = getStatutBadge(row.statut);
                            const points = row.points_theoriques;
                            const displayPosition = row.row_position;
                            
                            return (
                              <TableRow
                                key={row.race_result_id}
                                className={
                                  row.is_my_rider 
                                    ? "bg-yellow-100/60 dark:bg-yellow-900/20 border-l-2 border-l-yellow-400" 
                                    : ""
                                }
                              >
                                <TableCell className="font-medium px-1 py-1 text-center">
                                  {isFinished ? (
                                    displayPosition <= 3 ? (
                                      <span className="flex items-center justify-center gap-0.5">
                                        <span className="text-xs">
                                          {displayPosition === 1 ? "🥇" : 
                                           displayPosition === 2 ? "🥈" : "🥉"}
                                        </span>
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">{displayPosition}</span>
                                    )
                                  ) : statutBadge ? (
                                    <Badge variant={statutBadge.variant} className="text-[8px] px-0.5 py-0">
                                      {statutBadge.label.slice(0, 3)}
                                    </Badge>
                                  ) : (
                                    "—"
                                  )}
                                </TableCell>
                                <TableCell className="px-1 py-1">
                                  <div className="flex flex-col">
                                    <span className="font-semibold leading-tight truncate">{row.coureur_nom}</span>
                                    <span className="text-[9px] text-muted-foreground truncate">{row.equipe}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-bold px-1 py-1 tabular-nums">
                                  {points > 0 ? points : "—"}
                                </TableCell>
                                <TableCell className="px-1 py-1 text-right">
                                  {row.manager_nom && (
                                    <span className="text-[9px] text-muted-foreground truncate block">
                                      {row.manager_nom}
                                    </span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Aucun résultat disponible pour ce classement
                  </p>
                )}
              </div>
            </TabsContent>

            {/* Tab: Classements Étapes (for stage races only) */}
            <TabsContent value="stages" className="space-y-4 mt-4">
              <div className="space-y-4">
                {/* Dropdown for stages */}
                <Select
                  value={selectedEtape?.toString() || ""}
                  onValueChange={(value) => {
                    setSelectedType('Etape');
                    setSelectedEtape(parseInt(value));
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sélectionner une étape" />
                  </SelectTrigger>
                  <SelectContent>
                    {meta?.etapes_disponibles?.map((etape) => (
                      <SelectItem key={etape} value={etape.toString()}>
                        Étape {etape}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Results display */}
                {loading ? (
                  <Skeleton className="h-96 w-full" />
                ) : displayedResults.length > 0 ? (
                  isTTT ? (
                    <TTTResultsTable results={displayedResults} compact={true} />
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <Table className="text-[11px] table-fixed w-full">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-7 px-1 text-center">#</TableHead>
                            <TableHead className="px-1">Coureur</TableHead>
                            <TableHead className="text-right px-1 w-10">Pts</TableHead>
                            <TableHead className="px-1 w-16 text-right">Manager</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {displayedResults.map((row) => {
                            const isFinished = row.statut === 'finished' && row.row_position !== null;
                            const statutBadge = getStatutBadge(row.statut);
                            const points = row.points_theoriques;
                            const displayPosition = row.row_position;
                            
                            return (
                              <TableRow
                                key={row.race_result_id}
                                className={
                                  row.is_my_rider 
                                    ? "bg-yellow-100/60 dark:bg-yellow-900/20 border-l-2 border-l-yellow-400" 
                                    : ""
                                }
                              >
                                <TableCell className="px-1 py-1 text-center font-medium">
                                  {isFinished ? (
                                    displayPosition <= 3 ? (
                                      <div className="flex items-center justify-center gap-1">
                                        <span className="text-sm">
                                          {displayPosition === 1 ? "🥇" : displayPosition === 2 ? "🥈" : "🥉"}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground text-xs">
                                        {displayPosition}
                                      </span>
                                    )
                                  ) : statutBadge ? (
                                    <Badge variant={statutBadge.variant} className="text-[9px] px-1">
                                      {statutBadge.label}
                                    </Badge>
                                  ) : (
                                    "—"
                                  )}
                                </TableCell>
                                <TableCell className="px-1 py-1">
                                  <div className="flex flex-col">
                                    <span className="font-semibold leading-tight truncate">{row.coureur_nom}</span>
                                    <span className="text-[9px] text-muted-foreground truncate">{row.equipe}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-bold px-1 py-1">
                                  {points > 0 ? points : "—"}
                                </TableCell>
                                <TableCell className="px-1 py-1 text-right">
                                  {row.manager_nom && (
                                    <span className="text-[9px] text-muted-foreground truncate block">
                                      {row.manager_nom}
                                    </span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    {selectedEtape 
                      ? "Aucun résultat disponible pour cette étape" 
                      : "Veuillez sélectionner une étape"}
                  </p>
                )}

                {/* Jersey holders - moved to bottom */}
                {selectedEtape && (
                  <JerseyHoldersBar courseId={courseId} etapeNumero={selectedEtape} leagueId={leagueId} />
                )}
              </div>
            </TabsContent>

            {/* Tab: Résultats (for simple races only) */}
            <TabsContent value="results" className="space-y-4 mt-4">
              {/* Type selector pills - Only show if multiple types available */}
              {(() => {
                const filteredTypes = (meta?.types_disponibles || []).filter(type => !type.startsWith('Porteur'));
                const showTypeSelector = filteredTypes.length > 1;
                
                return showTypeSelector ? (
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant={selectedType === 'Total' ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleTypeChange('Total')}
                    >
                      Total
                    </Button>
                    {filteredTypes.map((type) => (
                      <Button
                        key={type}
                        variant={selectedType === type ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleTypeChange(type)}
                      >
                        {type}
                      </Button>
                    ))}
                  </div>
                ) : null;
              })()}

              {/* Total riders table */}
              {selectedType === 'Total' && !loading && totalRiders.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Coureur</TableHead>
                        <TableHead className="hidden md:table-cell">Manager</TableHead>
                        <TableHead className="hidden lg:table-cell">Équipe</TableHead>
                        <TableHead className="text-right">Points</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {totalRiders.map((rider) => {
                        const breakdown = getRiderBreakdown(rider.coureur_id);
                        const isExpanded = expandedRiders.has(rider.coureur_id);
                        
                        return (
                          <Collapsible 
                            key={rider.coureur_id} 
                            asChild 
                            open={isExpanded}
                            onOpenChange={() => toggleRider(rider.coureur_id)}
                          >
                            <>
                              <CollapsibleTrigger asChild>
                                <TableRow className="cursor-pointer hover:bg-muted/50 touch-manipulation">
                                  <TableCell>
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg">
                                        {rider.rank === 1 && '🥇'}
                                        {rider.rank === 2 && '🥈'}
                                        {rider.rank === 3 && '🥉'}
                                      </span>
                                      <div className="flex flex-col">
                                        <span className="font-semibold">{rider.coureur_nom}</span>
                                        <span className="text-xs text-muted-foreground md:hidden">
                                          {rider.manager_nom && `${rider.manager_nom} • `}{rider.equipe}
                                        </span>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell">
                                    {rider.manager_nom && (
                                      <Badge variant="secondary" className="text-xs">
                                        {rider.manager_nom}
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="hidden lg:table-cell">
                                    {rider.equipe && (
                                      <Badge variant="outline" className="text-xs">
                                        {rider.equipe}
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-bold">{Math.round(rider.total_points)}</TableCell>
                                </TableRow>
                              </CollapsibleTrigger>
                    <CollapsibleContent asChild>
                      <TableRow>
                        <TableCell colSpan={5} className="bg-muted/30 p-4">
                                    <div className="space-y-2">
                                      <div className="text-sm font-medium text-muted-foreground mb-2">
                                        Points marqués
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {breakdown.map((entry, idx) => (
                                          <div
                                            key={`${entry.type_classement}-${entry.etape_numero}-${idx}`}
                                            className="flex items-center justify-between p-2 rounded border bg-background"
                                          >
                                            <Badge variant="outline" className="text-xs">
                                              {formatClassementLabel(entry.type_classement, entry.etape_numero)}
                                            </Badge>
                                            <div className="font-bold">{Math.round(entry.points)} pts</div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              </CollapsibleContent>
                            </>
                          </Collapsible>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Results table */}
              {selectedType !== 'Total' && loading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : selectedType !== 'Total' && displayedResults.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {results.length === 0 
                    ? "Aucun résultat pour ce classement" 
                    : "Aucun résultat ne correspond à votre recherche"}
                </div>
              ) : selectedType !== 'Total' && (
                isTTT ? (
                  <TTTResultsTable results={displayedResults} compact={false} />
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table className="text-xs sm:text-sm">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12 px-2">Pos.</TableHead>
                          <TableHead className="px-2">Coureur</TableHead>
                          <TableHead className="text-right px-2 w-12">Pts</TableHead>
                          <TableHead className="px-2 w-16">Manager</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayedResults.map((row) => {
                          const isFinished = row.statut === 'finished' && row.row_position !== null;
                          const statutBadge = getStatutBadge(row.statut);
                          const points = row.points_theoriques;
                          const displayPosition = row.row_position;
                          
                          return (
                            <TableRow
                              key={row.race_result_id}
                              className={
                                row.is_my_rider 
                                  ? "bg-yellow-100/60 dark:bg-yellow-900/20 border-l-2 border-l-yellow-400" 
                                  : ""
                              }
                            >
                              <TableCell className="font-medium px-2 py-2">
                                {isFinished ? (
                                  <div className="flex items-center gap-1">
                                    {displayPosition <= 3 && (
                                      <span className="text-sm">
                                        {displayPosition === 1 ? "🥇" : 
                                         displayPosition === 2 ? "🥈" : "🥉"}
                                      </span>
                                    )}
                                    <span className="text-muted-foreground">
                                      {displayPosition}
                                    </span>
                                  </div>
                                ) : statutBadge ? (
                                  <Badge variant={statutBadge.variant} className="text-[10px] px-1 py-0">
                                    {statutBadge.label}
                                  </Badge>
                                ) : (
                                  "—"
                                )}
                              </TableCell>
                              <TableCell className="px-2 py-2">
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-semibold leading-tight">{row.coureur_nom}</span>
                                  <span className="text-[10px] text-muted-foreground">{row.equipe}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-bold px-2 py-2 tabular-nums">
                                {points > 0 ? points : "—"}
                              </TableCell>
                              <TableCell className="px-2 py-2">
                                {row.manager_nom && (
                                  <span className="text-[10px] text-muted-foreground truncate block max-w-[60px]">
                                    {row.manager_nom}
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )
              )}

              {/* Jersey bonuses section for Etape type */}
              {selectedType === 'Etape' && selectedEtape && !loading && (
                <StageJerseyBonuses 
                  courseId={courseId!} 
                  etapeNumero={selectedEtape}
                />
              )}
            </TabsContent>

            <TabsContent value="leaderboard" className="space-y-4 mt-4">
              {leaderboardLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !leaderboard?.leaderboard?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucun point pour ce classement
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead className="w-16">Rang</TableHead>
                        <TableHead>Manager</TableHead>
                        <TableHead className="text-right">Points</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaderboard.leaderboard.map((entry) => {
                        const contributors = getContributorsForManager(entry.manager_id);
                        const isExpanded = expandedManagers.has(entry.manager_id);
                        
                        return (
                          <Collapsible 
                            key={entry.manager_id} 
                            asChild 
                            open={isExpanded}
                            onOpenChange={() => toggleManager(entry.manager_id)}
                          >
                            <>
                              <CollapsibleTrigger asChild>
                                <TableRow className="cursor-pointer hover:bg-muted/50 touch-manipulation">
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="pointer-events-none"
                                    >
                                      {isExpanded ? (
                                        <ChevronDown className="h-4 w-4" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </TableCell>
                                  <TableCell className="font-bold">
                                    {entry.rank <= 3 && (
                                      <span className={`text-lg mr-1 ${
                                        entry.rank === 1 ? "text-bordure-gold" :
                                        entry.rank === 2 ? "text-muted-foreground" :
                                        "text-amber-600"
                                      }`}>
                                        {entry.rank === 1 ? "🥇" : 
                                         entry.rank === 2 ? "🥈" : "🥉"}
                                      </span>
                                    )}
                                    #{entry.rank}
                                  </TableCell>
                                  <TableCell className="font-medium">{entry.manager_nom}</TableCell>
                                  <TableCell className="text-right font-bold text-lg">{Math.round(entry.points)}</TableCell>
                                </TableRow>
                              </CollapsibleTrigger>
                              <CollapsibleContent asChild>
                                <TableRow>
                                  <TableCell colSpan={4} className="bg-muted/30 p-4">
                                    <div className="space-y-2">
                                      <div className="text-sm font-medium text-muted-foreground mb-2">
                                        Coureurs contributeurs
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {contributors.map((contributor, idx) => (
                                          <div
                                            key={`${contributor.rider_id}-${contributor.type_classement}-${contributor.etape_numero}-${idx}`}
                                            className="flex items-center justify-between p-2 rounded border bg-background"
                                          >
                                            <div className="flex-1">
                                              <div className="font-medium">{contributor.rider_nom}</div>
                                              <Badge variant="outline" className="mt-1 text-xs">
                                                {formatClassementLabel(contributor.type_classement, contributor.etape_numero)}
                                              </Badge>
                                            </div>
                                            <div className="font-bold">{Math.round(contributor.points)} pts</div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              </CollapsibleContent>
                            </>
                          </Collapsible>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
  );

  // Export dialog component (rendered outside of main dialog/drawer to avoid nesting)
  const exportDialog = meta && courseId && (
    <ExportResultsImage
      course={{
        course_id: courseId,
        course_nom: meta.course_nom,
        categorie: meta.categorie,
        type_course: meta.etapes_disponibles?.length > 0 ? "Stage race" : "One day",
        date_debut: meta.date_debut,
        date_fin: meta.date_fin,
        nb_etapes: meta.etapes_disponibles?.length || 0,
        phase_id: courseDetails?.phase_id || "",
      }}
      currentStage={selectedEtape || undefined}
      currentClassement={selectedType}
      open={exportDialogOpen}
      onOpenChange={setExportDialogOpen}
      leagueName={leagueInfo?.name}
      leagueId={leagueId || undefined}
    />
  );

  // Desktop: Dialog, Mobile: Drawer
  if (isMobile) {
    return (
      <>
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader>
              <DrawerTitle className="flex items-center justify-between gap-3">
                {headerContent}
                {shareButton}
              </DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4 space-y-4 overflow-y-auto">
              {bodyContent}
            </div>
          </DrawerContent>
        </Drawer>
        {exportDialog}
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3">
              {headerContent}
              {shareButton}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {bodyContent}
          </div>
        </DialogContent>
      </Dialog>
      {exportDialog}
    </>
  );
};
