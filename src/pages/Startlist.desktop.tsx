import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Users, AlertCircle, Download, FileText, Calendar, CalendarDays, Trophy, ArrowLeft, CheckCircle2, Star, Camera, Shirt, MessageSquare, LayoutGrid, List } from "lucide-react";
import { toPng } from "html-to-image";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays, differenceInDays, format, isToday } from "date-fns";
import { fr } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserRole } from "@/hooks/useUserRole";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RouteImageUploader } from "@/components/startlist/RouteImageUploader";
import { RouteImageModalContent } from "@/components/startlist/RouteImageGallery";
import { ManagerRatingModal } from "@/components/startlist/ManagerRatingModal";
import { ManagerStars } from "@/components/startlist/ManagerStars";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { useManagerSponsor } from "@/hooks/useManagerSponsor";
import { cn } from "@/lib/utils";
import { StartlistDesktopExport } from "@/components/startlist/StartlistDesktopExport";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLeague } from "@/contexts/LeagueContext";
import { StartlistCalendarView } from "@/components/startlist/StartlistCalendarView";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { StartlistTrackerMovements } from "@/components/startlist/StartlistTrackerMovements";
import { OptimizedImage } from "@/components/shared/OptimizedImage";

const StartlistDesktop = () => {
  
  const queryClient = useQueryClient();
  const { isSuperAdmin, isLeagueAdminOnly, loading: isLoadingRole } = useUserRole();
  const { leagueId } = useLeague();
  const [viewMode, setViewMode] = useState<'list' | 'view'>('list');
  const [displayMode, setDisplayMode] = useState<'cards' | 'calendar'>('calendar');
  const [tabMode, setTabMode] = useState<'30days' | '90days' | 'history' | 'upcoming-year'>('upcoming-year');
  const [selectedStartlistId, setSelectedStartlistId] = useState<string | null>(null);
  const [selectedRaceForViewing, setSelectedRaceForViewing] = useState<any>(null);
  const [showUnmatched, setShowUnmatched] = useState(false);
  const { phases, selectedSeason, isLoading: isLoadingContext } = useSeasonContext();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const startlistIdFromUrl = searchParams.get('startlistId');


  useEffect(() => {
    loadCurrentUser();
  }, []);

  // Open startlist from URL param (deep linking from notifications)
  useEffect(() => {
    if (startlistIdFromUrl) {
      setSelectedStartlistId(startlistIdFromUrl);
      setViewMode('view');
      // Clean up URL after opening
      searchParams.delete('startlistId');
      setSearchParams(searchParams, { replace: true });
    }
  }, [startlistIdFromUrl]);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: manager } = await supabase
        .from('managers')
        .select('id, nom')
        .eq('user_id', user.id)
        .single();
      setCurrentUser(manager);
    }
  };


  const seasonPhaseIds = phases?.map(p => p.id) || [];

  // Fetch upcoming courses filtered by league scope
  const { data: upcomingCourses, isLoading: isLoadingCourses } = useQuery({
    queryKey: ['upcoming-courses-startlist', leagueId, selectedSeason?.id, tabMode],
    queryFn: async () => {
      if (!leagueId) return [];
      
      console.log('[Startlist] Loading courses for league:', leagueId, 'season:', selectedSeason?.id);
      
      const today = new Date().toISOString().split('T')[0];
      const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const in90Days = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      // Call edge function to get league courses
      const { data: leagueCourses, error: edgeFnError } = await supabase.functions.invoke(
        'get-league-courses',
        { body: { league_id: leagueId, season_id: selectedSeason?.id } }
      );
      
      if (edgeFnError) {
        console.error('[Startlist] Error loading courses:', edgeFnError);
        throw edgeFnError;
      }

      console.log('[Startlist] Loaded courses:', leagueCourses?.courses?.length);
      const raw = leagueCourses?.courses || [];
      const courses = raw.map((c: any) => ({ ...c, id: c.course_id }));
      
      // Filter by tab mode - sort upcoming courses with next course first
      let filtered = courses;
      if (tabMode === 'history') {
        // Past courses: most recent first
        filtered = courses.filter((c: any) => c.date_fin < today)
          .sort((a: any, b: any) => b.date_fin.localeCompare(a.date_fin));
      } else {
        // All upcoming modes: filter then sort by date_debut ascending (next course first)
        let upcoming = courses.filter((c: any) => c.date_fin >= today);
        
        if (tabMode === '30days') {
          upcoming = upcoming.filter((c: any) => c.date_debut <= in30Days);
        } else if (tabMode === '90days') {
          upcoming = upcoming.filter((c: any) => c.date_debut <= in90Days);
        }
        // 'upcoming-year' shows all upcoming, no additional filter
        
        // Sort by proximity to today: closest start date first
        filtered = upcoming.sort((a: any, b: any) => a.date_debut.localeCompare(b.date_debut));
      }
      
      return filtered;
    },
    enabled: !!leagueId && !!selectedSeason?.id
  });

  // Check if startlist exists for a race
  const { data: existingStartlists } = useQuery({
    queryKey: ['startlist-imports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('startlist_imports')
        .select('id, race_id, created_at, pcs_validated')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch startlist view data when in view mode
  const { data: startlistViewData, isLoading: isLoadingStartlistView } = useQuery({
    queryKey: ['startlist-view', selectedStartlistId, isSuperAdmin, leagueId],
    enabled: !!selectedStartlistId && viewMode === 'view',
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('startlist-manager-view', {
        body: { 
          startlist_id: selectedStartlistId,
          league_id: leagueId
        }
      });
      
      if (error) throw error;
      
      // Get PCS validation info only (admin_rating_note comes from edge function as league-scoped)
      const { data: startlistData } = await supabase
        .from('startlist_imports')
        .select('pcs_validated, pcs_validated_at, pcs_validated_by_manager_id')
        .eq('id', selectedStartlistId)
        .single();
      
      return { ...data, ...startlistData };
    }
  });

  // Fetch all startlist entries (matched and unmatched)
  const { data: startlistEntriesData, isLoading: isLoadingEntries } = useQuery({
    queryKey: ['startlist-entries', selectedStartlistId],
    queryFn: async () => {
      if (!selectedStartlistId) return null;
      
      const { data, error } = await supabase.functions.invoke('startlist-entries-list', {
        body: { startlist_id: selectedStartlistId }
      });
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedStartlistId && viewMode === 'view'
  });

  // Fetch startlist metadata (for permission checks)
  const { data: startlistMeta } = useQuery({
    queryKey: ['startlist-meta', selectedStartlistId],
    enabled: !!selectedStartlistId && viewMode === 'view',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('startlist_imports')
        .select('id, race_id, created_by_manager_id')
        .eq('id', selectedStartlistId)
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  const normalizeId = (v?: string | null) => (v ?? '').trim().toLowerCase();

  const hasStartlist = (raceId: string) => {
    const rid = normalizeId(raceId);
    return existingStartlists?.some(s => normalizeId(s.race_id) === rid) || false;
  };

  const isPcsValidated = (raceId: string) => {
    const rid = normalizeId(raceId);
    return existingStartlists?.some(
      (s: any) => normalizeId(s.race_id) === rid && s.pcs_validated === true
    ) || false;
  };

  const getStartlistId = (raceId: string) => {
    const rid = normalizeId(raceId);
    // Find all startlists for this race and return the most recent one
    const matchingStartlists = existingStartlists?.filter(sl => normalizeId(sl.race_id) === rid);
    if (!matchingStartlists || matchingStartlists.length === 0) return undefined;
    // They're already sorted by created_at desc, so take the first one
    return matchingStartlists[0].id;
  };

  const handleSelectRace = async (race: any) => {
    console.log('[Startlist] handleSelectRace click', { raceId: race.id, existingCount: existingStartlists?.length });
    let startlistId = getStartlistId(race.id);

    if (!startlistId) {
      try {
        const { data: latest, error } = await supabase
          .from('startlist_imports')
          .select('id')
          .eq('race_id', race.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) console.warn('[Startlist] fallback query error', error);
        if (latest?.id) {
          startlistId = latest.id as string;
        }
      } catch (e) {
        console.warn('[Startlist] fallback query exception', e);
      }
    }

    if (startlistId) {
      console.log('[Startlist] startlist found, opening view', { startlistId });
      setSelectedStartlistId(startlistId);
      setSelectedRaceForViewing(race);
      setViewMode('view');
    } else {
      toast.info("Aucune startlist disponible pour cette course");
    }
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedStartlistId(null);
    setSelectedRaceForViewing(null);
  };

  const handlePcsValidation = async () => {
    if (!selectedStartlistId || !currentUser) return;
    
    const currentStatus = startlistViewData?.pcs_validated || false;
    const newStatus = !currentStatus;
    
    try {
      const { error } = await supabase
        .from('startlist_imports')
        .update({ 
          pcs_validated: newStatus,
          pcs_validated_at: newStatus ? new Date().toISOString() : null,
          pcs_validated_by_manager_id: newStatus ? currentUser.id : null
        })
        .eq('id', selectedStartlistId);

      if (error) throw error;

      toast.success(newStatus ? "SL validée ✓" : "Validation retirée");
      queryClient.invalidateQueries({ queryKey: ['startlist-view'] });
      queryClient.invalidateQueries({ queryKey: ['startlist-imports'] });
    } catch (error: any) {
      toast.error("Erreur : " + error.message);
    }
  };

  const handleExportImage = async () => {
    if (!exportRef.current) return;
    
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const dataUrl = await toPng(exportRef.current, {
        quality: 1,
        pixelRatio: 2,
        cacheBust: true
      });
      
      const link = document.createElement('a');
      link.download = `startlist-${startlistViewData?.race.nom}-${format(new Date(), 'yyyy-MM-dd')}.png`;
      link.href = dataUrl;
      link.click();
      
      toast.success("Image exportée avec succès !");
    } catch (error) {
      toast.error("Erreur lors de l'export");
      console.error(error);
    }
  };

  // View mode - show existing startlist
  if (viewMode === 'view') {
    if (isLoadingStartlistView) {
      return (
        <div className="container mx-auto p-6">
          <div className="flex items-center gap-2 mb-6">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-8 w-64" />
          </div>
          <Skeleton className="h-40 w-full" />
        </div>
      );
    }

    if (!startlistViewData) {
      return (
        <div className="container mx-auto p-6">
          <Button variant="ghost" onClick={handleBackToList} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour aux courses
          </Button>
          <Card className="p-6">
            <p className="text-muted-foreground">Impossible de charger la startlist.</p>
          </Card>
        </div>
      );
    }

    return (
      <div className="max-w-7xl mx-auto p-4 space-y-4 overflow-hidden">
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <Button variant="ghost" onClick={handleBackToList}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleExportImage} variant="outline" size="sm">
              <Camera className="h-3 w-3 mr-1" />
              Exporter la SL
            </Button>
            {(isSuperAdmin || isLeagueAdminOnly) && startlistViewData.managers.length > 0 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowRatingModal(true)}
              >
                <Star className="h-4 w-4 mr-2" />
                Noter les managers
              </Button>
            )}
          </div>
        </div>

        {/* ZONE DE CAPTURE */}
        <StartlistDesktopExport 
          ref={exportRef}
          startlistData={startlistViewData}
          onRouteImageClick={(imageUrl: string) => setIsImageModalOpen(true)}
        />
        {/* FIN ZONE DE CAPTURE */}

        {/* Modal pour afficher l'image en grand */}
        <Dialog open={isImageModalOpen} onOpenChange={setIsImageModalOpen}>
          <DialogContent className="max-w-7xl w-[95vw] max-h-[95vh] p-0">
            <DialogTitle className="sr-only">Image du parcours</DialogTitle>
            <RouteImageModalContent
              images={startlistViewData.route_images || []}
              fallbackUrl={startlistViewData.route_image_url}
              defaultStageNumber={(() => {
                const d = startlistViewData.race?.date_debut;
                if (!d) return undefined;
                const diff = Math.floor((new Date().getTime() - new Date(d).getTime()) / 86400000);
                return diff >= 0 ? diff + 1 : undefined;
              })()}
            />
          </DialogContent>
        </Dialog>


        {/* Modal de notation */}
        <ManagerRatingModal 
          open={showRatingModal}
          onOpenChange={setShowRatingModal}
          startlistId={selectedStartlistId!}
          leagueId={leagueId}
          managers={startlistViewData.managers}
          initialGlobalNote={startlistViewData.admin_rating_note || ""}
          onRatingsUpdated={() => queryClient.invalidateQueries({ queryKey: ['startlist-view', selectedStartlistId] })}
        />
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">Startlists</h1>
            <p className="text-muted-foreground mt-1">Cliquez sur une course pour consulter ou ajouter sa startlist</p>
          </div>
          
          {/* Toggle Cards / Calendar */}
          <ToggleGroup type="single" value={displayMode} onValueChange={(v) => v && setDisplayMode(v as 'cards' | 'calendar')}>
            <ToggleGroupItem value="cards" aria-label="Vue cartes">
              <LayoutGrid className="h-4 w-4 mr-2" />
              Cartes
            </ToggleGroupItem>
            <ToggleGroupItem value="calendar" aria-label="Vue calendrier">
              <CalendarDays className="h-4 w-4 mr-2" />
              Calendrier
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Tabs - hidden in calendar view since calendar has its own navigation */}
        {displayMode === 'cards' && (
          <Tabs value={tabMode} onValueChange={(v) => setTabMode(v as '30days' | '90days' | 'history' | 'upcoming-year')}>
            <TabsList className="grid w-full max-w-2xl grid-cols-4">
              <TabsTrigger value="history">Historique</TabsTrigger>
              <TabsTrigger value="30days">30 jours</TabsTrigger>
              <TabsTrigger value="90days">90 jours</TabsTrigger>
              <TabsTrigger value="upcoming-year">Année à venir</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {isLoadingCourses ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : displayMode === 'calendar' ? (
          // Calendar view - show all courses for the season
          <StartlistCalendarView 
            courses={upcomingCourses || []}
            hasStartlist={hasStartlist}
            isPcsValidated={isPcsValidated}
            onSelectRace={handleSelectRace}
          />
        ) : upcomingCourses && upcomingCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingCourses
              .filter((course: any) => {
                // En mode "history", ne montrer QUE les courses avec startlist
                if (tabMode === 'history') {
                  return hasStartlist(course.id);
                }
                return true;
              })
              .map((course: any) => {
              const dateDebut = new Date(course.date_debut);
              const dateFin = new Date(course.date_fin);
              const todayStr = new Date().toISOString().split('T')[0];
              const isOngoing = course.date_debut <= todayStr && course.date_fin >= todayStr;
              const daysUntil = differenceInCalendarDays(dateDebut, new Date());
              const duration = differenceInDays(dateFin, dateDebut) + 1;
              const estimatedStages = course.type_course === 'etape' ? duration : 1;
              const phaseData = course.phases as any;

              // Countdown label - more dynamic
              const getCountdownLabel = () => {
                if (isOngoing) return 'En cours';
                if (daysUntil === 0) return "Aujourd'hui";
                if (daysUntil === 1) return 'Demain';
                if (daysUntil < 0) return 'Passée';
                return `J-${daysUntil}`;
              };

              return (
                <Card 
                  key={course.id} 
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleSelectRace(course)}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <CardTitle className="text-lg line-clamp-2">{course.nom}</CardTitle>
                      <div className="flex gap-1.5 shrink-0">
                        {isOngoing && (
                          <Badge className="bg-destructive text-destructive-foreground animate-pulse">
                            EN COURS
                          </Badge>
                        )}
                        {hasStartlist(course.id) && (
                          <Badge variant="outline" className="bg-accent text-accent-foreground">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Startlist
                          </Badge>
                        )}
                        {isPcsValidated(course.id) && (
                          <Badge variant="default" className="bg-primary text-primary-foreground">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            SL officielle
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {phaseData && (
                        <Badge variant="secondary">
                          Phase {phaseData.index_dans_saison}
                        </Badge>
                      )}
                      {course.categorie && (
                        <Badge variant="outline">{course.categorie}</Badge>
                      )}
                      {course.type_course && (
                        <Badge variant="outline" className="capitalize">
                          {course.type_course}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {format(dateDebut, 'dd MMM', { locale: fr })}
                        {duration > 1 && ` - ${format(dateFin, 'dd MMM', { locale: fr })}`}
                      </span>
                    </div>
                    
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "bg-primary/10",
                        daysUntil <= 1 && daysUntil >= 0 && "bg-accent text-accent-foreground font-semibold",
                        isOngoing && "bg-destructive/10 text-destructive"
                      )}
                    >
                      {getCountdownLabel()}
                    </Badge>
                    
                    {estimatedStages > 1 && (
                      <div className="text-sm text-muted-foreground">
                        ~{estimatedStages} étapes estimées
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {tabMode === 'history' 
                  ? "Aucune course passée avec startlist" 
                  : tabMode === '30days'
                  ? "Aucune course prévue dans les 30 prochains jours"
                  : tabMode === '90days'
                  ? "Aucune course prévue dans les 90 prochains jours"
                  : "Aucune course à venir cette année"}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Startlist tracker movements for current phase */}
        {(() => {
          const today = new Date().toISOString().split('T')[0];
          const currentPhase = phases?.find(p => p.date_debut <= today && p.date_fin >= today)
            || phases?.filter(p => p.date_debut > today).sort((a, b) => a.date_debut.localeCompare(b.date_debut))[0];
          if (currentPhase && leagueId) {
            return <StartlistTrackerMovements phaseId={currentPhase.id} leagueId={leagueId} />;
          }
          return null;
        })()}
      </div>
    );
  }

  // Fallback - should never reach here
  return null;
};

const ManagerJerseyDisplay = ({ managerName, managerId }: { managerName: string; managerId: string }) => {
  const { selectedSeason } = useSeasonContext();
  const { data: sponsorData } = useManagerSponsor(managerId, selectedSeason?.id);
  
  return (
    <div className="flex items-center gap-2">
      {sponsorData?.jersey_image_url ? (
        <OptimizedImage 
          src={sponsorData.jersey_image_url} 
          alt={`Maillot de ${managerName}`}
          inline
          width={48}
          height={48}
          className="h-12 w-12 object-contain rounded"
        />
      ) : (
        <Shirt className="h-8 w-8 text-muted-foreground" />
      )}
      <span className="text-sm text-muted-foreground">{managerName}</span>
    </div>
  );
};

export default StartlistDesktop;
