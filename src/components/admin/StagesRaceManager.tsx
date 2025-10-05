import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, AlertCircle, Calculator, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CoureursCombobox } from "@/components/shared/CoureursCombobox";

interface StageOverview {
  course: {
    id: string;
    nom: string;
    categorie: string;
    nb_etapes: number;
  };
  stages: Array<{
    etape_numero: number;
    is_top10_complete: boolean;
    has_leader: boolean;
    has_points_leader: boolean;
    has_montagne_leader: boolean;
    is_complete: boolean;
  }>;
  gc_requirements: {
    required_top: 10 | 15;
    required_jerseys: string[];
    all_stages_complete: boolean;
  };
}

export function StagesRaceManager() {
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [activeTab, setActiveTab] = useState("stages");
  const [editingStage, setEditingStage] = useState<number | null>(null);
  const [phaseId, setPhaseId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch courses with stages
  const { data: courses } = useQuery({
    queryKey: ["courses-with-stages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, nom, categorie, date_debut, date_fin, phase_id")
        .eq("type_course", "stage")
        .order("date_debut", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch overview for selected course
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["stage-overview", selectedCourse],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-stage-overview", {
        body: { course_id: selectedCourse },
      });

      if (error) throw error;
      return data as StageOverview;
    },
    enabled: !!selectedCourse,
  });

  // Compute points mutation
  const computePointsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("compute-points", {
        body: { course_id: selectedCourse },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Points recalculés avec succès");
      queryClient.invalidateQueries({ queryKey: ["stage-overview", selectedCourse] });
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const completeStages = overview?.stages.filter(s => s.is_complete).length || 0;
  const totalStages = overview?.course.nb_etapes || 0;
  const incompleteStages = overview?.stages
    .filter(s => !s.is_complete)
    .map(s => `#${s.etape_numero}`)
    .join(", ");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gestion des courses à étapes</CardTitle>
          <CardDescription>
            Saisir les résultats d'étapes et classement général
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Course</label>
              <Select value={selectedCourse} onValueChange={(value) => {
                setSelectedCourse(value);
                const course = courses?.find(c => c.id === value);
                setPhaseId(course?.phase_id || null);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une course à étapes" />
                </SelectTrigger>
                <SelectContent>
                  {courses?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nom} — {new Date(c.date_debut).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {selectedCourse && (
              <div className="flex items-end">
                <Button
                  onClick={() => computePointsMutation.mutate()}
                  disabled={computePointsMutation.isPending}
                  variant="outline"
                >
                  {computePointsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Calculator className="h-4 w-4 mr-2" />
                  )}
                  Recalculer les points
                </Button>
              </div>
            )}
          </div>

          {selectedCourse && overview && (
            <Alert>
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span>
                    <strong>Progression:</strong> {completeStages}/{totalStages} étapes complètes
                  </span>
                  <div className="flex gap-2">
                    <Badge variant="outline">
                      CG: Top {overview.gc_requirements.required_top}
                    </Badge>
                    <Badge variant="outline">
                      Maillots: {overview.gc_requirements.required_jerseys.join(", ")}
                    </Badge>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {selectedCourse && overview && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="stages">Étapes</TabsTrigger>
            <TabsTrigger value="gc">Classement Général (CG)</TabsTrigger>
          </TabsList>

          <TabsContent value="stages" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Saisie des étapes</CardTitle>
                <CardDescription>
                  Compléter le Top 10 et les porteurs de maillots après chaque étape
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {overview.stages.map((stage) => (
                    <Button
                      key={stage.etape_numero}
                      variant={stage.is_complete ? "outline" : "secondary"}
                      className="h-auto flex-col gap-2 p-4"
                      onClick={() => setEditingStage(stage.etape_numero)}
                    >
                      {stage.is_complete ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-amber-500" />
                      )}
                      <span className="font-semibold">Étape {stage.etape_numero}</span>
                      <div className="text-xs text-muted-foreground">
                        {stage.is_top10_complete ? "✓" : "✗"} Top 10<br/>
                        {stage.has_leader ? "✓" : "✗"} Leader<br/>
                        {stage.has_points_leader ? "✓" : "✗"} Points<br/>
                        {stage.has_montagne_leader ? "✓" : "✗"} Montagne
                      </div>
                    </Button>
                  ))}
                </div>

                {editingStage !== null && phaseId && (
                  <StageEditor
                    courseId={selectedCourse}
                    phaseId={phaseId}
                    etapeNumero={editingStage}
                    onClose={() => {
                      setEditingStage(null);
                      queryClient.invalidateQueries({ queryKey: ["stage-overview", selectedCourse] });
                    }}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gc" className="space-y-4">
            {!overview.gc_requirements.all_stages_complete ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Terminez d'abord toutes les étapes (Top 10 + porteurs à chaque étape).
                  <br />
                  Étapes manquantes : {incompleteStages}
                </AlertDescription>
              </Alert>
            ) : phaseId ? (
              <GCEditor
                courseId={selectedCourse}
                phaseId={phaseId}
                requiredTop={overview.gc_requirements.required_top}
                requiredJerseys={overview.gc_requirements.required_jerseys}
                onSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ["stage-overview", selectedCourse] });
                  toast.success("Classement général enregistré");
                }}
              />
            ) : null}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// Stage Editor Component
function StageEditor({
  courseId,
  phaseId,
  etapeNumero,
  onClose,
}: {
  courseId: string;
  phaseId: string;
  etapeNumero: number;
  onClose: () => void;
}) {
  const [top10, setTop10] = useState<Array<{ position: number; coureur_id: string }>>([]);
  const [generalLeader, setGeneralLeader] = useState("");
  const [pointsLeader, setPointsLeader] = useState("");
  const [montagneLeader, setMontagneLeader] = useState("");

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Build top10 array
      const top10Data = Array.from({ length: 10 }, (_, i) => ({
        position: i + 1,
        coureur_id: top10.find(t => t.position === i + 1)?.coureur_id || "",
      }));

      // Validate all positions filled
      if (top10Data.some(t => !t.coureur_id)) {
        throw new Error("Toutes les positions du Top 10 doivent être remplies");
      }

      // Check duplicates
      const ids = top10Data.map(t => t.coureur_id);
      if (new Set(ids).size !== ids.length) {
        throw new Error("Un coureur ne peut pas apparaître deux fois dans le Top 10");
      }

      if (!generalLeader || !pointsLeader || !montagneLeader) {
        throw new Error("Les trois porteurs de maillots sont requis");
      }

      const { data, error } = await supabase.functions.invoke("admin-stage-save-step", {
        body: {
          course_id: courseId,
          etape_numero: etapeNumero,
          top10: top10Data,
          leaders: {
            general_leader_id: generalLeader,
            points_leader_id: pointsLeader,
            montagne_leader_id: montagneLeader,
          },
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(`Étape ${etapeNumero} enregistrée`);
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleTop10Change = (position: number, coureurId: string) => {
    setTop10(prev => {
      const filtered = prev.filter(t => t.position !== position);
      if (coureurId) {
        return [...filtered, { position, coureur_id: coureurId }];
      }
      return filtered;
    });
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Étape {etapeNumero}</CardTitle>
        <CardDescription>Top 10 + Porteurs de maillots après l'étape</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold mb-3">Top 10 de l'étape</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((position) => (
              <div key={position} className="flex items-center gap-3">
                <Badge variant="outline" className="w-8 justify-center shrink-0">
                  {position}
                </Badge>
                <CoureursCombobox
                  phaseId={phaseId}
                  value={top10.find(t => t.position === position)?.coureur_id || null}
                  onSelect={(coureur) => handleTop10Change(position, coureur?.coureur_id || "")}
                  placeholder={`${position}${position === 1 ? "er" : "e"} position`}
                  showTakenRiders={true}
                />
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div>
          <h3 className="text-sm font-semibold mb-3">Porteurs après l'étape</h3>
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Maillot Leader (Général provisoire)</label>
              <CoureursCombobox
                phaseId={phaseId}
                value={generalLeader || null}
                onSelect={(coureur) => setGeneralLeader(coureur?.coureur_id || "")}
                placeholder="Sélectionner le porteur du maillot leader"
                showTakenRiders={true}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Maillot Points</label>
              <CoureursCombobox
                phaseId={phaseId}
                value={pointsLeader || null}
                onSelect={(coureur) => setPointsLeader(coureur?.coureur_id || "")}
                placeholder="Sélectionner le porteur du maillot points"
                showTakenRiders={true}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Maillot Montagne</label>
              <CoureursCombobox
                phaseId={phaseId}
                value={montagneLeader || null}
                onSelect={(coureur) => setMontagneLeader(coureur?.coureur_id || "")}
                placeholder="Sélectionner le porteur du maillot montagne"
                showTakenRiders={true}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enregistrer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// GC Editor Component
function GCEditor({
  courseId,
  phaseId,
  requiredTop,
  requiredJerseys,
  onSuccess,
}: {
  courseId: string;
  phaseId: string;
  requiredTop: 10 | 15;
  requiredJerseys: string[];
  onSuccess: () => void;
}) {
  const [generalTop, setGeneralTop] = useState<Array<{ position: number; coureur_id: string }>>([]);
  const [generalWinner, setGeneralWinner] = useState("");
  const [pointsWinner, setPointsWinner] = useState("");
  const [montagneWinner, setMontagneWinner] = useState("");
  const [jeuneWinner, setJeuneWinner] = useState("");

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Build general top array
      const generalTopData = Array.from({ length: requiredTop }, (_, i) => ({
        position: i + 1,
        coureur_id: generalTop.find(t => t.position === i + 1)?.coureur_id || "",
      }));

      // Validate all positions filled
      if (generalTopData.some(t => !t.coureur_id)) {
        throw new Error(`Toutes les positions du Top ${requiredTop} doivent être remplies`);
      }

      // Check duplicates
      const ids = generalTopData.map(t => t.coureur_id);
      if (new Set(ids).size !== ids.length) {
        throw new Error("Un coureur ne peut pas apparaître deux fois dans le classement");
      }

      if (!generalWinner) {
        throw new Error("Le vainqueur général est requis");
      }

      const jerseyWinners: any = {
        general_winner_id: generalWinner,
      };

      if (requiredJerseys.includes("Points")) {
        if (!pointsWinner) throw new Error("Le vainqueur du classement par points est requis");
        jerseyWinners.points_winner_id = pointsWinner;
      }

      if (requiredJerseys.includes("Montagne")) {
        if (!montagneWinner) throw new Error("Le vainqueur du classement de la montagne est requis");
        jerseyWinners.montagne_winner_id = montagneWinner;
      }

      if (requiredJerseys.includes("Jeune")) {
        if (!jeuneWinner) throw new Error("Le vainqueur du classement des jeunes est requis");
        jerseyWinners.jeune_winner_id = jeuneWinner;
      }

      const { data, error } = await supabase.functions.invoke("admin-gc-save", {
        body: {
          course_id: courseId,
          general_top: generalTopData,
          jersey_winners: jerseyWinners,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleGeneralTopChange = (position: number, coureurId: string) => {
    setGeneralTop(prev => {
      const filtered = prev.filter(t => t.position !== position);
      if (coureurId) {
        return [...filtered, { position, coureur_id: coureurId }];
      }
      return filtered;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Classement Général Final</CardTitle>
        <CardDescription>
          Cette course requiert Top {requiredTop} en CG
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold mb-3">Top {requiredTop} du Classement Général</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: requiredTop }, (_, i) => i + 1).map((position) => (
              <div key={position} className="flex items-center gap-3">
                <Badge variant="outline" className="w-8 justify-center shrink-0">
                  {position}
                </Badge>
                <CoureursCombobox
                  phaseId={phaseId}
                  value={generalTop.find(t => t.position === position)?.coureur_id || null}
                  onSelect={(coureur) => handleGeneralTopChange(position, coureur?.coureur_id || "")}
                  placeholder={`${position}${position === 1 ? "er" : "e"} position`}
                  showTakenRiders={true}
                />
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div>
          <h3 className="text-sm font-semibold mb-3">Vainqueurs des Maillots</h3>
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Vainqueur Général (obligatoire)</label>
              <CoureursCombobox
                phaseId={phaseId}
                value={generalWinner || null}
                onSelect={(coureur) => setGeneralWinner(coureur?.coureur_id || "")}
                placeholder="Sélectionner le vainqueur général"
                showTakenRiders={true}
              />
            </div>

            {requiredJerseys.includes("Points") && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Vainqueur Classement par Points</label>
                <CoureursCombobox
                  phaseId={phaseId}
                  value={pointsWinner || null}
                  onSelect={(coureur) => setPointsWinner(coureur?.coureur_id || "")}
                  placeholder="Sélectionner le vainqueur du classement par points"
                  showTakenRiders={true}
                />
              </div>
            )}

            {requiredJerseys.includes("Montagne") && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Vainqueur Classement de la Montagne</label>
                <CoureursCombobox
                  phaseId={phaseId}
                  value={montagneWinner || null}
                  onSelect={(coureur) => setMontagneWinner(coureur?.coureur_id || "")}
                  placeholder="Sélectionner le vainqueur du classement de la montagne"
                  showTakenRiders={true}
                />
              </div>
            )}

            {requiredJerseys.includes("Jeune") && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Vainqueur Classement des Jeunes</label>
                <CoureursCombobox
                  phaseId={phaseId}
                  value={jeuneWinner || null}
                  onSelect={(coureur) => setJeuneWinner(coureur?.coureur_id || "")}
                  placeholder="Sélectionner le vainqueur du classement des jeunes"
                  showTakenRiders={true}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            size="lg"
          >
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enregistrer le Classement Général
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
