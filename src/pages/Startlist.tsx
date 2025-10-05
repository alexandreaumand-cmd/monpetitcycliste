import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Search, Download, LogOut, Users, Upload, AlertCircle, 
  CheckCircle2, Menu, ListChecks, FileText, Edit2, Eye 
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Step = 'select' | 'upload' | 'preview' | 'correct' | 'view';

export default function Startlist() {
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [step, setStep] = useState<Step>('select');
  const [selectedRaceId, setSelectedRaceId] = useState<string>("");
  const [textContent, setTextContent] = useState("");
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [teamFilter, setTeamFilter] = useState("");

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    },
  });

  const { data: currentManager } = useQuery({
    queryKey: ['current-manager'],
    enabled: !!session,
    queryFn: async () => {
      const { data } = await supabase
        .from('managers')
        .select('id, nom, user_id, sponsor')
        .eq('user_id', session!.user.id)
        .single();
      
      return data;
    }
  });

  // Fetch races with startlists
  const { data: races, refetch: refetchRaces } = useQuery({
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

  // Fetch all courses for selection
  const { data: allCourses } = useQuery({
    queryKey: ['all-courses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, nom, date_debut, categorie, phase_id')
        .order('date_debut', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    }
  });

  // Fetch manager view for selected race
  const { data: managerView, isLoading: viewLoading, refetch: refetchView } = useQuery({
    queryKey: ['startlist-manager-view', selectedRaceId],
    enabled: !!selectedRaceId && step === 'view',
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

  // Fetch unmatched entries for correction
  const { data: unmatchedData, refetch: refetchUnmatched } = useQuery({
    queryKey: ['unmatched-entries', uploadResult?.startlist_id],
    enabled: !!uploadResult?.startlist_id && step === 'correct',
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('startlist-review-unmatched', {
        body: { startlist_id: uploadResult.startlist_id }
      });

      if (error) throw error;
      return data;
    }
  });

  const handleUpload = async () => {
    if (!selectedRaceId || !textContent.trim()) {
      toast.error("Veuillez sélectionner une course et coller le contenu de la startlist");
      return;
    }

    try {
      const formData = new FormData();
      formData.append('race_id', selectedRaceId);
      formData.append('text_content', textContent);

      const { data, error } = await supabase.functions.invoke('startlist-upload-and-parse', {
        body: Object.fromEntries(formData)
      });

      if (error) throw error;

      setUploadResult(data);
      toast.success(`${data.counts.matched} coureurs matchés sur ${data.counts.parsed}`);
      
      if (data.counts.unmatched > 0) {
        setStep('preview');
      } else {
        setStep('view');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error("Erreur lors de l'upload: " + error.message);
    }
  };

  const handleContinueToCorrection = () => {
    setStep('correct');
  };

  const handleSkipCorrection = () => {
    setStep('view');
  };

  const handleConfirmMatches = async (decisions: { entry_id: string; coureur_id: string }[]) => {
    if (decisions.length === 0) {
      toast.error("Aucune correction à appliquer");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('startlist-confirm-matches', {
        body: {
          startlist_id: uploadResult.startlist_id,
          decisions,
          save_alias: true
        }
      });

      if (error) throw error;

      toast.success(`${data.matched_now} coureurs matchés`);
      
      if (data.remaining_unmatched === 0) {
        setStep('view');
        await refetchRaces();
      } else {
        await refetchUnmatched();
      }
    } catch (error: any) {
      console.error('Confirm error:', error);
      toast.error("Erreur lors de la confirmation: " + error.message);
    }
  };

  const handleExportCSV = async () => {
    if (!selectedRaceId) return;
    
    const startlist = races?.find(r => r.race_id === selectedRaceId);
    if (!startlist) return;

    try {
      const { data, error } = await supabase.functions.invoke('startlist-export-csv', {
        body: { startlist_id: startlist.id }
      });

      if (error) throw error;

      const blob = new Blob([data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `startlist_${selectedRaceId}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast.success("Export CSV réussi");
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error("Erreur lors de l'export: " + error.message);
    }
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

  // Sort managers: current user first
  const sortedManagers = filteredManagers?.sort((a, b) => {
    if (currentManager) {
      if (a.manager_id === currentManager.id) return -1;
      if (b.manager_id === currentManager.id) return 1;
    }
    return b.starters_count - a.starters_count;
  });

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Skeleton className="h-16 w-full" />
        <div className="container mx-auto p-6">
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!isAdmin && !currentManager) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Vous devez être manager ou administrateur pour accéder à cette page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header manager={currentManager} isAdmin={isAdmin} onSignOut={handleSignOut} />
      
      <div className="container mx-auto p-6 space-y-6">
        {/* Step: Select race */}
        {step === 'select' && (
          <Card>
            <CardHeader>
              <CardTitle>Sélectionner une course</CardTitle>
              <CardDescription>
                {isAdmin 
                  ? "Uploadez une nouvelle startlist ou consultez une startlist existante"
                  : "Consultez les startlists disponibles"
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Course</label>
                <Select value={selectedRaceId} onValueChange={setSelectedRaceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une course..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allCourses?.map((course: any) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.nom} ({new Date(course.date_debut).toLocaleDateString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                {isAdmin && selectedRaceId && (
                  <Button onClick={() => setStep('upload')}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Startlist
                  </Button>
                )}
                {selectedRaceId && races?.find(r => r.race_id === selectedRaceId) && (
                  <Button variant="outline" onClick={() => setStep('view')}>
                    <Eye className="h-4 w-4 mr-2" />
                    Voir la startlist
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Upload (admin only) */}
        {step === 'upload' && isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Upload Startlist</CardTitle>
              <CardDescription>
                Copiez-collez le contenu du PDF de la startlist ci-dessous
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Collez ici le contenu de la startlist...&#10;&#10;Formats supportés:&#10;- BIB NOM EQUIPE&#10;- NOM EQUIPE&#10;- BIB NOM"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={15}
                className="font-mono text-sm"
              />
              
              <div className="flex gap-2">
                <Button onClick={handleUpload}>
                  <Upload className="h-4 w-4 mr-2" />
                  Parser et Matcher
                </Button>
                <Button variant="outline" onClick={() => setStep('select')}>
                  Annuler
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Preview */}
        {step === 'preview' && uploadResult && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Résumé du parsing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-2xl font-bold">{uploadResult.counts.parsed}</div>
                    <div className="text-sm text-muted-foreground">Lignes parsées</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{uploadResult.counts.matched}</div>
                    <div className="text-sm text-muted-foreground">Matchés</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-orange-600">{uploadResult.counts.unmatched}</div>
                    <div className="text-sm text-muted-foreground">À corriger</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {uploadResult.sample && uploadResult.sample.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Aperçu (10 premières lignes)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {uploadResult.sample.map((entry: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded border">
                        <div className="flex gap-2 items-center">
                          {entry.bib_no && <Badge variant="outline">#{entry.bib_no}</Badge>}
                          <span className="font-medium">{entry.source_name}</span>
                          {entry.source_team && <span className="text-sm text-muted-foreground">({entry.source_team})</span>}
                        </div>
                        {entry.coureur_id ? (
                          <Badge variant="default">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Matché ({Math.round(entry.confidence * 100)}%)
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Non matché
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-2">
              {uploadResult.counts.unmatched > 0 && (
                <Button onClick={handleContinueToCorrection}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Corriger les {uploadResult.counts.unmatched} non matchés
                </Button>
              )}
              <Button variant="outline" onClick={handleSkipCorrection}>
                <Eye className="h-4 w-4 mr-2" />
                Voir par manager
              </Button>
            </div>
          </div>
        )}

        {/* Step: Correct (admin only) */}
        {step === 'correct' && unmatchedData && (
          <CorrectionView 
            unmatchedData={unmatchedData}
            onConfirm={handleConfirmMatches}
            onSkip={() => setStep('view')}
          />
        )}

        {/* Step: Manager view */}
        {step === 'view' && selectedRaceId && (
          <>
            {viewLoading ? (
              <Skeleton className="h-96" />
            ) : managerView ? (
              <div className="space-y-4">
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

                  <div className="flex gap-2">
                    <Button onClick={handleExportCSV} variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                    <Button variant="outline" onClick={() => setStep('select')}>
                      Changer de course
                    </Button>
                  </div>
                </div>

                {/* Manager cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sortedManagers?.map((manager: any) => (
                    <Card key={manager.manager_id} className={
                      currentManager?.id === manager.manager_id 
                        ? "border-primary shadow-lg" 
                        : ""
                    }>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{manager.manager_nom}</CardTitle>
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
                              key={starter.coureur_id}
                              className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-muted/50"
                            >
                              <div className="flex-1">
                                <div className="font-medium">{starter.nom}</div>
                                {starter.equipe && (
                                  <div className="text-xs text-muted-foreground">{starter.equipe}</div>
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
              </div>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Aucune startlist disponible pour cette course.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Correction Component
function CorrectionView({ 
  unmatchedData, 
  onConfirm, 
  onSkip 
}: { 
  unmatchedData: any; 
  onConfirm: (decisions: { entry_id: string; coureur_id: string }[]) => void;
  onSkip: () => void;
}) {
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});

  const handleSelect = (entryId: string, coureurId: string) => {
    setDecisions(prev => ({ ...prev, [entryId]: coureurId }));
  };

  const handleConfirm = () => {
    const decisionsArray = Object.entries(decisions).map(([entry_id, coureur_id]) => ({
      entry_id,
      coureur_id
    }));
    onConfirm(decisionsArray);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Correction des noms non reconnus</CardTitle>
              <CardDescription>
                {unmatchedData.items.length} coureurs à corriger
              </CardDescription>
            </div>
            <Badge variant="outline">
              {Object.keys(decisions).length}/{unmatchedData.items.length} corrigés
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {unmatchedData.items.map((item: any) => (
            <div key={item.entry_id} className="p-4 border rounded space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{item.source_name}</div>
                  {item.source_team && (
                    <div className="text-sm text-muted-foreground">{item.source_team}</div>
                  )}
                </div>
                {item.bib_no && <Badge variant="outline">#{item.bib_no}</Badge>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Sélectionner le coureur correspondant:</label>
                {item.suggestions.length > 0 ? (
                  <div className="space-y-1">
                    {item.suggestions.map((sugg: any) => (
                      <Button
                        key={sugg.coureur_id}
                        variant={decisions[item.entry_id] === sugg.coureur_id ? "default" : "outline"}
                        className="w-full justify-between"
                        onClick={() => handleSelect(item.entry_id, sugg.coureur_id)}
                      >
                        <span>{sugg.nom} {sugg.equipe && `(${sugg.equipe})`}</span>
                        <Badge variant="secondary">{Math.round(sugg.score * 100)}%</Badge>
                      </Button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucune suggestion - utilisez la recherche manuelle</p>
                )}
                
                <RiderSearchInput
                  value={searchTerms[item.entry_id] || ''}
                  onChange={(value) => setSearchTerms(prev => ({ ...prev, [item.entry_id]: value }))}
                  onSelect={(coureurId) => handleSelect(item.entry_id, coureurId)}
                  selectedId={decisions[item.entry_id]}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button 
          onClick={handleConfirm}
          disabled={Object.keys(decisions).length === 0}
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Valider ({Object.keys(decisions).length} corrections)
        </Button>
        <Button variant="outline" onClick={onSkip}>
          Passer cette étape
        </Button>
      </div>
    </div>
  );
}

// Simple rider search component
function RiderSearchInput({
  value,
  onChange,
  onSelect,
  selectedId
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (coureurId: string) => void;
  selectedId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [debouncedValue] = useState(value);

  const { data: riders = [] } = useQuery({
    queryKey: ['riders-search', value],
    queryFn: async () => {
      if (value.length < 2) return [];
      
      const { data } = await supabase
        .from('coureurs')
        .select('id, nom, equipe')
        .ilike('nom', `%${value}%`)
        .limit(10);
      
      return data || [];
    },
    enabled: value.length >= 2
  });

  return (
    <div className="relative">
      <Input
        placeholder="Rechercher un coureur manuellement..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        className="w-full"
      />
      {open && riders.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-md">
          {riders.map((rider) => (
            <button
              key={rider.id}
              className={cn(
                "w-full text-left px-3 py-2 hover:bg-accent text-sm",
                selectedId === rider.id && "bg-accent"
              )}
              onClick={() => {
                onSelect(rider.id);
                setOpen(false);
                onChange(rider.nom);
              }}
            >
              <div className="font-medium">{rider.nom}</div>
              {rider.equipe && (
                <div className="text-xs text-muted-foreground">{rider.equipe}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
