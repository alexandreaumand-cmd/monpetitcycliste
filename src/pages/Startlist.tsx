import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Users, AlertCircle, Download, FileText, Calendar, Trophy, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useQuery } from "@tanstack/react-query";
import { differenceInDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

const Startlist = () => {
  const [viewMode, setViewMode] = useState<'list' | 'parse'>('list');
  const [selectedRaceForParsing, setSelectedRaceForParsing] = useState<any>(null);
  const [selectedRaceId, setSelectedRaceId] = useState<string>("");
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>("");
  const [textContent, setTextContent] = useState<string>("");
  const [parseResult, setParseResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [races, setRaces] = useState<any[]>([]);
  const [phases, setPhases] = useState<any[]>([]);
  const [showUnmatched, setShowUnmatched] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

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

    if (!selectedPhaseId && !selectedRaceId) {
      toast.error("Veuillez sélectionner une course ou une phase");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('startlist-parse-text', {
        body: { 
          race_id: selectedRaceId || null,
          phase_id: selectedPhaseId || null,
          text: textContent 
        }
      });

      if (error) throw error;

      setParseResult(data);
      toast.success(`${data.counts.matched} coureurs identifiés sur ${data.counts.lines} lignes`);
      
      if (data.counts.unmatched > 0) {
        setShowUnmatched(true);
      }
    } catch (error: any) {
      console.error('Parse error:', error);
      toast.error("Erreur lors du parsing: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!parseResult) return;

    const rows = [['Manager', 'Coureur', 'Équipe', 'Code Équipe']];
    
    parseResult.managers.forEach((m: any) => {
      m.starters.forEach((s: any) => {
        rows.push([m.manager_nom, s.nom, s.equipe || '', s.team_code || '']);
      });
    });

    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'startlist.csv';
    a.click();
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
        .select('race_id');
      
      if (error) throw error;
      return data || [];
    }
  });

  const hasStartlist = (raceId: string) => {
    return existingStartlists?.some(s => s.race_id === raceId) || false;
  };

  const handleSelectRace = (race: any) => {
    setSelectedRaceForParsing(race);
    setSelectedRaceId(race.id);
    setSelectedPhaseId(race.phase_id);
    setViewMode('parse');
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedRaceForParsing(null);
    setTextContent('');
    setParseResult(null);
  };

  const selectedRace = races.find(r => r.id === selectedRaceId);

  if (viewMode === 'list') {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Prochaines courses</h1>
            <p className="text-muted-foreground mt-1">Cliquez sur une course pour ajouter sa startlist</p>
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
                      {hasStartlist(course.id) && (
                        <Badge variant="outline" className="bg-green-500/10 shrink-0">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Startlist
                        </Badge>
                      )}
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
          <Button onClick={handleExportCSV} variant="outline">
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
            <div className="flex gap-2 flex-wrap">
              {selectedRace && (
                <Badge variant="secondary">{selectedRace.nom}</Badge>
              )}
              <Badge variant="outline">
                {parseResult.counts.lines} lignes
              </Badge>
              <Badge variant="outline" className="bg-green-500/10">
                {parseResult.counts.matched} matchés
              </Badge>
              {parseResult.counts.unmatched > 0 && (
                <Badge 
                  variant="outline" 
                  className="bg-orange-500/10 cursor-pointer"
                  onClick={() => setShowUnmatched(true)}
                >
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {parseResult.counts.unmatched} à corriger
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {parseResult && (
        <>
          <div>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Users className="h-6 w-6" />
              Vue par manager
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Current user's team first */}
              {parseResult.managers
                .filter((m: any) => currentUser && m.manager_id === currentUser.id)
                .map((manager: any) => (
                  <Card key={manager.manager_id} className="border-2 border-primary">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg">{manager.manager_nom}</CardTitle>
                        <Badge>Mon équipe</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {manager.starters_count} au départ
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1 max-h-[300px] overflow-y-auto">
                        {manager.starters.map((s: any, i: number) => (
                          <div key={i} className="text-sm">
                            {s.nom} <span className="text-muted-foreground">({s.equipe})</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
              ))}

              {/* Other managers */}
              {parseResult.managers
                .filter((m: any) => !currentUser || m.manager_id !== currentUser.id)
                .map((manager: any) => (
                  <Card key={manager.manager_id}>
                    <CardHeader>
                      <CardTitle className="text-lg">{manager.manager_nom}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {manager.starters_count} au départ
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1 max-h-[300px] overflow-y-auto">
                        {manager.starters.map((s: any, i: number) => (
                          <div key={i} className="text-sm">
                            {s.nom} <span className="text-muted-foreground">({s.equipe})</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
              ))}
            </div>
          </div>

          {parseResult.no_owner && parseResult.no_owner.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Sans propriétaire (dans cette phase)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {parseResult.no_owner.map((s: any, i: number) => (
                    <div key={i} className="text-sm">
                      {s.nom} <span className="text-muted-foreground">({s.equipe})</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Unmatched panel */}
      <Sheet open={showUnmatched} onOpenChange={setShowUnmatched}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>À corriger ({parseResult?.counts.unmatched || 0})</SheetTitle>
          </SheetHeader>
          
          <div className="mt-6 space-y-4">
            {parseResult?.unmatched.map((entry: any, i: number) => (
              <Card key={i}>
                <CardContent className="pt-4 space-y-2">
                  <div className="font-medium">{entry.source_name}</div>
                  <div className="text-sm text-muted-foreground">
                    Code: {entry.team_code} | Ligne {entry.line_no}
                  </div>
                  <div className="text-sm text-muted-foreground italic">
                    Suggestion: {entry.canonical_guess}
                  </div>
                  
                  <Separator />
                  
                  <div className="text-sm font-medium">Suggestions:</div>
                  {entry.suggestions.length > 0 ? (
                    <div className="space-y-1">
                      {entry.suggestions.map((sug: any, j: number) => (
                        <div key={j} className="text-sm flex justify-between">
                          <span>{sug.nom} ({sug.equipe})</span>
                          <span className="text-muted-foreground">
                            {(sug.score * 100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">Aucune suggestion</div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Startlist;
