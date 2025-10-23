import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Users, AlertCircle, Download, FileText, Calendar, Trophy, ArrowLeft, CheckCircle2, Star, Camera, Shirt, MessageSquare } from "lucide-react";
import { toPng } from "html-to-image";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserRole } from "@/hooks/useUserRole";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RouteImageUploader } from "@/components/startlist/RouteImageUploader";
import { ManagerRatingModal } from "@/components/startlist/ManagerRatingModal";
import { ManagerStars } from "@/components/startlist/ManagerStars";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { useManagerSponsor } from "@/hooks/useManagerSponsor";
import { cn } from "@/lib/utils";
import { StartlistDesktopExport } from "@/components/startlist/StartlistDesktopExport";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLeague } from "@/contexts/LeagueContext";

const StartlistDesktop = () => {
  
  const queryClient = useQueryClient();
  const { leagueId } = useLeague();
  const [viewMode, setViewMode] = useState<'list' | 'parse' | 'view'>('list');
  const [tabMode, setTabMode] = useState<'30days' | '90days' | 'history' | 'upcoming-year'>('30days');
  const [selectedRaceForParsing, setSelectedRaceForParsing] = useState<any>(null);
  const [selectedStartlistId, setSelectedStartlistId] = useState<string | null>(null);
  const [selectedRaceForViewing, setSelectedRaceForViewing] = useState<any>(null);
  const [selectedRaceId, setSelectedRaceId] = useState<string>("");
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>("");
  const [textContent, setTextContent] = useState<string>("");
  const [parseResult, setParseResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [races, setRaces] = useState<any[]>([]);
  const [showUnmatched, setShowUnmatched] = useState(false);
  const { phases, isLoading: isLoadingContext } = useSeasonContext();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const [startlisteurNote, setStartlisteurNote] = useState<string>("");


  useEffect(() => {
    loadData();
    loadCurrentUser();
  }, []);

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

  const loadData = async () => {
    // Load recent races (will be filtered by season phases in query)
    const { data: racesData } = await supabase
      .from('courses')
      .select('id, nom, date_debut, phase_id')
      .order('date_debut', { ascending: false })
      .limit(50);
    
    if (racesData) setRaces(racesData);
  };

  const handleParse = async () => {
    if (!textContent.trim()) {
      toast.error("Veuillez coller le texte de la startlist");
      return;
    }

    if (!selectedPhaseId) {
      toast.error("Veuillez sélectionner une phase");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('startlist-parse-text', {
        body: { 
          race_id: selectedRaceId || null,
          phase_id: selectedPhaseId,
          text: textContent,
          with_diagnostics: showDiagnostics,
          startlisteur_note: startlisteurNote.trim() || null
        }
      });

      if (error) throw error;

      // Invalider le cache pour recharger les données
      queryClient.invalidateQueries({ queryKey: ['startlist-imports'] });
      
      // Basculer automatiquement en mode 'view' avec le nouveau startlist
      const newStartlistId = data.startlist_id;
      setSelectedStartlistId(newStartlistId);
      setSelectedRaceForViewing(selectedRaceForParsing);
      setViewMode('view');
      setStartlisteurNote("");
      
      toast.success(
        `Startlist enregistrée : ${data.counts.matched_db} coureurs matchés sur ${data.counts.parsed}`
      );
      
    } catch (error: any) {
      console.error('Parse error:', error);
      toast.error("Erreur lors du parsing: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCSV = async (startlistId?: string) => {
    const idToExport = startlistId || parseResult?.startlist_id;
    if (!idToExport) return;

    try {
      const { data, error } = await supabase.functions.invoke('startlist-export-csv', {
        body: { startlist_id: idToExport }
      });

      if (error) throw error;

      const blob = new Blob([data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `startlist_${idToExport}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV exporté avec succès');
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error('Erreur lors de l\'export: ' + error.message);
    }
  };

  const seasonPhaseIds = phases?.map(p => p.id) || [];

  // Fetch upcoming courses filtered by league scope
  const { data: upcomingCourses, isLoading: isLoadingCourses } = useQuery({
    queryKey: ['upcoming-courses-startlist', leagueId, tabMode],
    queryFn: async () => {
      if (!leagueId) return [];
      
      console.log('[Startlist] Loading courses for league:', leagueId);
      
      const today = new Date().toISOString().split('T')[0];
      const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const in90Days = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      // Call edge function to get league courses
      const { data: leagueCourses, error: edgeFnError } = await supabase.functions.invoke(
        'get-league-courses',
        { body: { league_id: leagueId, season_id: null } }
      );
      
      if (edgeFnError) {
        console.error('[Startlist] Error loading courses:', edgeFnError);
        throw edgeFnError;
      }

      console.log('[Startlist] Loaded courses:', leagueCourses?.courses?.length);
      const courses = leagueCourses?.courses || [];
      
      // Filter by tab mode
      let filtered = courses;
      if (tabMode === 'history') {
        filtered = courses.filter((c: any) => c.date_fin < today)
          .sort((a: any, b: any) => b.date_fin.localeCompare(a.date_fin));
      } else if (tabMode === '30days') {
        filtered = courses.filter((c: any) => 
          c.date_fin >= today && c.date_debut <= in30Days
        ).sort((a: any, b: any) => a.date_debut.localeCompare(b.date_debut));
      } else if (tabMode === '90days') {
        filtered = courses.filter((c: any) => 
          c.date_fin >= today && c.date_debut <= in90Days
        ).sort((a: any, b: any) => a.date_debut.localeCompare(b.date_debut));
      } else if (tabMode === 'upcoming-year') {
        filtered = courses.filter((c: any) => c.date_fin >= today)
          .sort((a: any, b: any) => a.date_debut.localeCompare(b.date_debut));
      }
      
      return filtered;
    },
    enabled: !!leagueId
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
    queryKey: ['startlist-view', selectedStartlistId, leagueId],
    enabled: !!selectedStartlistId && viewMode === 'view',
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('startlist-manager-view', {
        body: { 
          startlist_id: selectedStartlistId,
          league_id: leagueId
        }
      });
      
      if (error) throw error;
      
      // Get PCS validation info and admin note
      const { data: startlistData } = await supabase
        .from('startlist_imports')
        .select('pcs_validated, pcs_validated_at, pcs_validated_by_manager_id, admin_rating_note')
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
      console.log('[Startlist] no startlist found, opening parse');
      setSelectedRaceForParsing(race);
      setSelectedRaceId(race.id);
      setSelectedPhaseId(race.phase_id);
      setViewMode('parse');
    }
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedRaceForParsing(null);
    setSelectedStartlistId(null);
    setSelectedRaceForViewing(null);
    setTextContent('');
    setParseResult(null);
  };

  const handleModifyStartlist = () => {
    setSelectedRaceForParsing(selectedRaceForViewing);
    setSelectedRaceId(selectedRaceForViewing?.id);
    setSelectedPhaseId(selectedRaceForViewing?.phase_id);
    setViewMode('parse');
  };

  const handlePcsValidation = async () => {
    if (!selectedStartlistId || !currentUser) return;
    
    const currentStatus = startlistViewData?.pcs_validated || false;
    const newStatus = !currentStatus;
    
    setIsLoading(true);
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

      toast.success(newStatus ? "Startlist validée PCS ✓" : "Validation PCS retirée");
      queryClient.invalidateQueries({ queryKey: ['startlist-view'] });
      queryClient.invalidateQueries({ queryKey: ['startlist-imports'] });
    } catch (error: any) {
      toast.error("Erreur : " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedRace = races.find(r => r.id === selectedRaceId);
  const { isSuperAdmin, loading: isLoadingRole } = useUserRole();
  
  // Check if user can modify: admin OR creator of the startlist
  const canModify = isSuperAdmin || (currentUser?.id && startlistMeta?.created_by_manager_id && currentUser.id === startlistMeta.created_by_manager_id);

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
            {isSuperAdmin && (
              <RouteImageUploader
                startlistId={selectedStartlistId!}
                currentImageUrl={startlistViewData.route_image_url}
                onUploadComplete={() => queryClient.invalidateQueries({ queryKey: ['startlist-view', selectedStartlistId] })}
              />
            )}
            {canModify && (
              <Button onClick={handleModifyStartlist} variant="outline" size="sm">
                Modifier la SL
              </Button>
            )}
            {isSuperAdmin && !startlistViewData?.pcs_validated && (
              <Button 
                onClick={handlePcsValidation} 
                variant="default" 
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Valider PCS
              </Button>
            )}
            {isSuperAdmin && startlistViewData?.pcs_validated && (
              <Button 
                onClick={handlePcsValidation} 
                variant="outline"
                size="sm"
                className="bg-green-600 text-white hover:bg-green-700 border-green-600"
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                PCS OK (retirer)
              </Button>
            )}
            {isSuperAdmin && startlistViewData.managers.length > 0 && (
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
        />
        {/* FIN ZONE DE CAPTURE */}

        {/* Modal pour afficher l'image en grand */}
        <Dialog open={isImageModalOpen} onOpenChange={setIsImageModalOpen}>
          <DialogContent className="max-w-7xl w-[95vw] max-h-[95vh] p-0">
            <DialogTitle className="sr-only">Image du parcours</DialogTitle>
            <div className="relative w-full h-full flex items-center justify-center p-4">
              <img 
                src={startlistViewData.route_image_url} 
                alt="Parcours en grand format" 
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
              />
            </div>
          </DialogContent>
        </Dialog>


        {/* Modal de notation */}
        <ManagerRatingModal 
          open={showRatingModal}
          onOpenChange={setShowRatingModal}
          startlistId={selectedStartlistId!}
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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Startlists</h1>
            <p className="text-muted-foreground mt-1">Cliquez sur une course pour consulter ou ajouter sa startlist</p>
          </div>
        </div>

        {/* 4 onglets avec Tabs */}
        <Tabs value={tabMode} onValueChange={(v) => setTabMode(v as '30days' | '90days' | 'history' | 'upcoming-year')}>
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="history">Historique</TabsTrigger>
            <TabsTrigger value="30days">30 jours</TabsTrigger>
            <TabsTrigger value="90days">90 jours</TabsTrigger>
            <TabsTrigger value="upcoming-year">Année à venir</TabsTrigger>
          </TabsList>
        </Tabs>

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
              const today = new Date().toISOString().split('T')[0];
              const isOngoing = course.date_debut <= today && course.date_fin >= today;
              const daysUntil = differenceInDays(dateDebut, new Date());
              const duration = differenceInDays(dateFin, dateDebut) + 1;
              const estimatedStages = course.type_course === 'etape' ? duration : 1;
              const phaseData = course.phases as any;

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
                          <Badge className="bg-red-600 text-white animate-pulse">
                            EN COURS
                          </Badge>
                        )}
                        {hasStartlist(course.id) && (
                          <Badge variant="outline" className="bg-green-500/10">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Startlist
                          </Badge>
                        )}
                        {isPcsValidated(course.id) && (
                          <Badge variant="outline" className="bg-green-600 text-white">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            PCS OK
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
                    
                    {daysUntil >= 0 ? (
                      <Badge variant="outline" className="bg-primary/10">
                        J-{daysUntil}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-muted">
                        En cours
                      </Badge>
                    )}
                    
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
      </div>
    );
  }

  // Parse view
  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <Button 
            variant="ghost" 
            onClick={handleBackToList}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour aux courses
          </Button>
          <h1 className="text-3xl font-bold">
            {selectedRaceForParsing?.nom || 'Startlist'}
          </h1>
          {selectedRaceForParsing && (
            <p className="text-muted-foreground">
              {format(new Date(selectedRaceForParsing.date_debut), 'dd MMMM yyyy', { locale: fr })}
            </p>
          )}
        </div>
        {parseResult && (
          <Button onClick={() => handleExportCSV()} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exporter CSV
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coller le texte de la startlist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Course (optionnel)</label>
              <Select value={selectedRaceId} onValueChange={(v) => {
                setSelectedRaceId(v);
                const race = races.find(r => r.id === v);
                if (race?.phase_id) setSelectedPhaseId(race.phase_id);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une course..." />
                </SelectTrigger>
                <SelectContent>
                  {races.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nom} ({new Date(r.date_debut).toLocaleDateString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Phase</label>
              <Select value={selectedPhaseId} onValueChange={setSelectedPhaseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une phase..." />
                </SelectTrigger>
                <SelectContent>
                  {phases.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      Phase {p.index_dans_saison} ({new Date(p.date_debut).toLocaleDateString('fr-FR', { month: 'short' })} - {new Date(p.date_fin).toLocaleDateString('fr-FR', { month: 'short' })})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Texte (format: rang. CODE NOM Prénom temps)
            </label>
            <Textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="0. MBH NESPOLI Lorenzo 0:00&#10;0. UAD LAENGEN Vegard Stake 0:00&#10;0. JAY DE MARCHI Alessandro 0:00"
              className="min-h-[200px] font-mono text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Le mot du startlisteur (optionnel)
            </label>
            <Textarea
              value={startlisteurNote}
              onChange={(e) => setStartlisteurNote(e.target.value)}
              placeholder="Ajoutez un commentaire sur cette startlist..."
              className="min-h-[80px] resize-none"
              maxLength={500}
            />
            <span className="text-xs text-muted-foreground mt-1 block">
              {startlisteurNote.length} / 500 caractères
            </span>
          </div>

          {isSuperAdmin && (
            <div className="flex items-center space-x-2">
              <Switch
                id="diagnostics"
                checked={showDiagnostics}
                onCheckedChange={setShowDiagnostics}
              />
              <Label htmlFor="diagnostics">Activer les diagnostics (admin)</Label>
            </div>
          )}

          <div className="flex gap-2">
            <Button 
              onClick={handleParse} 
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Identification...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Identifier les coureurs
                </>
              )}
            </Button>
            
            {parseResult && (
              <Button 
                onClick={() => {
                  setTextContent('');
                  setParseResult(null);
                  setSelectedRaceId('');
                }}
                variant="outline"
              >
                Effacer
              </Button>
            )}
          </div>

          {parseResult && (
            <div className="space-y-2">
              <div className="flex gap-2 flex-wrap">
                {selectedRace && (
                  <Badge variant="secondary">{selectedRace.nom}</Badge>
                )}
                {selectedPhaseId && (
                  <Badge variant="secondary">Phase {phases.find(p => p.id === selectedPhaseId)?.index_dans_saison}</Badge>
                )}
              </div>
              
              <div className="p-4 bg-muted rounded-lg">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="font-medium">Lignes parsées</div>
                    <div className="text-2xl font-bold">{parseResult.counts.parsed}</div>
                  </div>
                  <div>
                    <div className="font-medium">Trouvés en BDD</div>
                    <div className="text-2xl font-bold text-green-600">{parseResult.counts.matched_db}</div>
                  </div>
                  <div>
                    <div className="font-medium">Dans vos rosters</div>
                    <div className="text-2xl font-bold text-blue-600">{parseResult.counts.on_roster}</div>
                  </div>
                  <div>
                    <div className="font-medium">Non trouvés</div>
                    <div className="text-2xl font-bold text-orange-600">
                      {parseResult.counts.unmatched}
                      {parseResult.counts.unmatched > 0 && (
                        <Button 
                          variant="link" 
                          size="sm" 
                          className="ml-2"
                          onClick={() => setShowUnmatched(true)}
                        >
                          Voir
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button onClick={async () => {
                  try {
                    const { data, error } = await supabase.functions.invoke('startlist-export-csv-from-text', {
                      body: { result: parseResult }
                    });

                    if (error) throw error;

                    const blob = new Blob([data], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `startlist_export.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success('CSV exporté');
                  } catch (error: any) {
                    toast.error('Erreur export: ' + error.message);
                  }
                }} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Exporter CSV
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
};

const ManagerJerseyDisplay = ({ managerName, managerId }: { managerName: string; managerId: string }) => {
  const { selectedSeason } = useSeasonContext();
  const { data: sponsorData } = useManagerSponsor(managerId, selectedSeason?.id);
  
  return (
    <div className="flex items-center gap-2">
      {sponsorData?.jersey_image_url ? (
        <img 
          src={sponsorData.jersey_image_url} 
          alt="Maillot" 
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
