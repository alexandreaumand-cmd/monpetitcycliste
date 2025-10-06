import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Users, AlertCircle, Download, FileText, Calendar, Trophy, ArrowLeft, CheckCircle2, Star, Camera } from "lucide-react";
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
import { FormIndicator } from "@/components/startlist/FormIndicator";

const Startlist = () => {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'list' | 'parse' | 'view'>('list');
  const [selectedRaceForParsing, setSelectedRaceForParsing] = useState<any>(null);
  const [selectedStartlistId, setSelectedStartlistId] = useState<string | null>(null);
  const [selectedRaceForViewing, setSelectedRaceForViewing] = useState<any>(null);
  const [selectedRaceId, setSelectedRaceId] = useState<string>("");
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>("");
  const [textContent, setTextContent] = useState<string>("");
  const [parseResult, setParseResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [races, setRaces] = useState<any[]>([]);
  const [phases, setPhases] = useState<any[]>([]);
  const [showUnmatched, setShowUnmatched] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

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
    // Load recent races
    const { data: racesData } = await supabase
      .from('courses')
      .select('id, nom, date_debut, phase_id')
      .order('date_debut', { ascending: false })
      .limit(50);
    
    if (racesData) setRaces(racesData);

    // Load active phases
    const { data: phasesData } = await supabase
      .from('phases')
      .select('id, index_dans_saison, saisons(annee)')
      .order('index_dans_saison', { ascending: false })
      .limit(10);
    
    if (phasesData) setPhases(phasesData);
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
          with_diagnostics: showDiagnostics
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

  // Fetch upcoming courses
  const { data: upcomingCourses, isLoading: isLoadingCourses } = useQuery({
    queryKey: ['upcoming-courses-startlist'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('courses')
        .select(`
          id,
          nom,
          date_debut,
          date_fin,
          categorie,
          type_course,
          phase_id,
          phases (
            index_dans_saison,
            saisons (annee)
          )
        `)
        .gte('date_debut', today)
        .lte('date_debut', in30Days)
        .order('date_debut', { ascending: true });
      
      if (error) throw error;
      return data || [];
    }
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
    queryKey: ['startlist-view', selectedStartlistId],
    enabled: !!selectedStartlistId && viewMode === 'view',
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('startlist-manager-view', {
        body: { startlist_id: selectedStartlistId }
      });
      
      if (error) throw error;
      
      // Get PCS validation info
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
  const { isAdmin, loading: isLoadingRole } = useUserRole();
  
  // Check if user can modify: admin OR creator of the startlist
  const canModify = isAdmin || (currentUser?.id && startlistMeta?.created_by_manager_id && currentUser.id === startlistMeta.created_by_manager_id);

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
            {isAdmin && (
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
            {isAdmin && !startlistViewData?.pcs_validated && (
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
            {isAdmin && startlistViewData?.pcs_validated && (
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
            {isAdmin && startlistViewData.managers.length > 0 && (
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
        <div ref={exportRef} className="relative space-y-4">
          {/* Badge PCS OK - visible uniquement si validé */}
          {startlistViewData.pcs_validated && (
            <div className="absolute top-2 right-2 z-10 bg-green-600 text-white px-3 py-1 rounded-full flex items-center gap-1 text-sm font-semibold shadow-lg">
              <CheckCircle2 className="h-4 w-4" />
              PCS OK
            </div>
          )}

          {/* Header compact avec barème */}
          <Card className="p-4">
            <div className="mb-3">
              <h2 className="text-xl font-bold">{startlistViewData.race.nom}</h2>
              <p className="text-sm text-muted-foreground">
                {format(new Date(startlistViewData.race.date_debut), 'dd MMMM yyyy', { locale: fr })} • {startlistViewData.race.categorie}
              </p>
            </div>

          {/* Section barème + image côte à côte */}
          <div className="grid grid-cols-4 gap-3 mb-3">
            {/* Barème de points - 3/4 de la largeur */}
            {startlistViewData.scoring && startlistViewData.scoring.rules && startlistViewData.scoring.rules.length > 0 && (
              <Card className="bg-muted/50 p-3 col-span-3">
                <h4 className="font-semibold text-xs mb-2">Barème ({startlistViewData.scoring.categorie})</h4>
                <div className="grid grid-cols-5 gap-x-4 gap-y-1 text-xs">
                  {startlistViewData.scoring.rules
                    .filter((r: any) => r.type_classement === 'General')
                    .slice(0, 10)
                    .map((rule: any) => (
                      <div key={rule.place} className="flex gap-1">
                        <span className="font-medium">{rule.place}e:</span>
                        <span className="text-muted-foreground">{rule.points}pts</span>
                      </div>
                    ))}
                </div>
              </Card>
            )}
            
            {/* Image de parcours - 1/4 de la largeur */}
            {startlistViewData.route_image_url && (
              <Card className="bg-muted/50 p-3 overflow-hidden col-span-1">
                <h4 className="font-semibold text-xs mb-2">Parcours</h4>
                <div className="overflow-hidden rounded border">
                  <img 
                    src={startlistViewData.route_image_url} 
                    alt="Parcours" 
                    className="w-full h-auto object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setIsImageModalOpen(true)}
                  />
                </div>
              </Card>
            )}
          </div>

            {/* Stats */}
            <div className="flex gap-4 text-xs">
              <div><span className="font-medium">Managers:</span> {startlistViewData.totals.managers}</div>
              <div><span className="font-medium">Partants:</span> {startlistViewData.totals.starters_all}</div>
            </div>
          </Card>

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

          {/* Section Managers */}
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-4">Managers au départ</h3>

            {/* Grille compacte des managers */}
            <div className="grid grid-cols-5 gap-3">
              {startlistViewData.managers.map((manager: any) => (
                <Card key={manager.manager_id} className="p-3">
                  {/* En-tête manager */}
                  <div className="mb-2 pb-2 border-b">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm truncate mb-1">{manager.manager_nom}</h4>
                        <ManagerStars avgStars={manager.avg_stars} votes={manager.votes} showVotes={manager.votes > 1} />
                        {manager.sponsor && (
                          <p className="text-xs text-muted-foreground truncate mt-1">{manager.sponsor}</p>
                        )}
                      </div>
                    </div>
                  
                    {/* Classements */}
                    <div className="grid grid-cols-2 gap-2 text-xs mb-1">
                      <div>
                        <span className="font-medium">Phase:</span> #{manager.rank_phase || '-'}
                        {manager.points_phase > 0 && (
                          <span className="text-muted-foreground ml-1">({manager.points_phase}pts)</span>
                        )}
                      </div>
                      <div>
                        <span className="font-medium">CG:</span> #{manager.rank_total || '-'}
                        {manager.points_total > 0 && (
                          <span className="text-muted-foreground ml-1">({manager.points_total}pts)</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Liste coureurs */}
                  <div className="space-y-0.5">
                    {manager.starters.map((starter: any) => (
                      <div key={starter.coureur_id} className="text-xs flex justify-between items-center gap-2">
                        <span className="font-medium truncate flex-1 min-w-0">{starter.nom}</span>
                        <FormIndicator results={starter.recent_results || []} />
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        </div>
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
            <h1 className="text-3xl font-bold">Prochaines courses</h1>
            <p className="text-muted-foreground mt-1">Cliquez sur une course pour consulter ou ajouter sa startlist</p>
          </div>
        </div>

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
            {upcomingCourses.map((course: any) => {
              const dateDebut = new Date(course.date_debut);
              const dateFin = new Date(course.date_fin);
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
              <p className="text-muted-foreground">Aucune course prévue dans les 30 prochains jours</p>
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
                      Phase {p.index_dans_saison} - {(p.saisons as any)?.annee}
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

          {isAdmin && (
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

export default Startlist;
