import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ChipGroup,
  MobileCard,
  MobileBottomSheet,
  KPIRow,
  MobileEmptyState,
  MobileStickyBottom,
} from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Trophy,
  FileText,
  Loader2,
  Users,
  Calendar,
  Star,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Image as ImageIcon,
  MessageSquare,
} from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { ManagerStars } from "@/components/startlist/ManagerStars";
import { ManagerRatingModal } from "@/components/startlist/ManagerRatingModal";
import { useSeasonContext } from "@/contexts/SeasonContext";

export const StartlistMobile = () => {
  const queryClient = useQueryClient();
  const { isAdmin } = useUserRole();
  const { phases, isLoading: isLoadingContext } = useSeasonContext();
  const [viewMode, setViewMode] = useState<"list" | "parse" | "view">("list");
  const [selectedRaceId, setSelectedRaceId] = useState("");
  const [selectedPhaseId, setSelectedPhaseId] = useState("");
  const [selectedStartlistId, setSelectedStartlistId] = useState<string | null>(null);
  const [textContent, setTextContent] = useState("");
  const [parseResult, setParseResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showUnmatched, setShowUnmatched] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [expandedManagers, setExpandedManagers] = useState<Set<string>>(new Set());

  const seasonPhaseIds = phases?.map(p => p.id) || [];

  // Fetch races
  const { data: races } = useQuery({
    queryKey: ["startlist-races", seasonPhaseIds.join(',')],
    queryFn: async () => {
      if (seasonPhaseIds.length === 0) return [];
      
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from("courses")
        .select("id, nom, date_debut, phase_id, categorie")
        .in("phase_id", seasonPhaseIds)
        .gte("date_debut", today)
        .order("date_debut", { ascending: true })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !isLoadingContext && seasonPhaseIds.length > 0
  });

  // Fetch all startlist info in one query
  const { data: startlistsInfo } = useQuery({
    queryKey: ["startlists-info"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("startlist_imports")
        .select("id, race_id, pcs_validated")
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      // Group by race_id, keeping only the most recent
      const byRace = new Map();
      data?.forEach(sl => {
        if (!byRace.has(sl.race_id)) {
          byRace.set(sl.race_id, sl);
        }
      });
      return byRace;
    },
  });


  // Fetch startlist view data
  const { data: startlistViewData, isLoading: viewLoading } = useQuery({
    queryKey: ["startlist-view-mobile", selectedStartlistId],
    queryFn: async () => {
      if (!selectedStartlistId) return null;
      
      const { data, error } = await supabase.functions.invoke("startlist-manager-view", {
        body: { startlist_id: selectedStartlistId },
      });
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedStartlistId && viewMode === "view",
  });

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
      const { data, error } = await supabase.functions.invoke("startlist-parse-text", {
        body: {
          race_id: selectedRaceId || null,
          phase_id: selectedPhaseId,
          text: textContent,
        },
      });

      if (error) throw error;
      setParseResult(data);
      toast.success("Parsing terminé !");
    } catch (error: any) {
      toast.error("Erreur : " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectRace = (raceId: string, startlistId: string) => {
    setSelectedStartlistId(startlistId);
    setExpandedManagers(new Set()); // Reset expanded managers
    setViewMode("view");
  };

  // LIST MODE
  if (viewMode === "list") {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Startlists</h2>
          <Button size="sm" onClick={() => setViewMode("parse")}>
            <FileText className="h-4 w-4 mr-2" />
            Parser
          </Button>
        </div>

        {!races || races.length === 0 ? (
          <MobileEmptyState
            icon={<Trophy className="h-12 w-12" />}
            title="Aucune course"
            description="Les courses apparaîtront ici"
          />
        ) : (
          <div className="space-y-3">
            {races.map((race) => {
              const startlistInfo = startlistsInfo?.get(race.id);
              const hasStartlist = !!startlistInfo;
              const isPcsValidated = startlistInfo?.pcs_validated || false;

              return (
                <MobileCard
                  key={race.id}
                  title={race.nom}
                  subtitle={format(new Date(race.date_debut), "dd MMMM yyyy", { locale: fr })}
                  avatar={
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                  }
                  badge={
                    <div className="flex gap-1">
                      {race.categorie && (
                        <Badge variant="outline" className="text-xs">
                          {race.categorie}
                        </Badge>
                      )}
                      {isPcsValidated && (
                        <Badge className="bg-green-600 text-white text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          PCS OK
                        </Badge>
                      )}
                    </div>
                  }
                  onClick={() => {
                    if (hasStartlist && startlistInfo?.id) {
                      handleSelectRace(race.id, startlistInfo.id);
                    } else {
                      toast.info("Aucune startlist pour cette course");
                    }
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // PARSE MODE
  if (viewMode === "parse") {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="sm" onClick={() => setViewMode("list")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          <h2 className="text-lg font-bold flex-1">Parser une startlist</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Course (optionnel)</label>
            <Select value={selectedRaceId} onValueChange={setSelectedRaceId}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une course..." />
              </SelectTrigger>
              <SelectContent>
                {races?.map((race) => (
                  <SelectItem key={race.id} value={race.id}>
                    {race.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Phase *</label>
            <Select value={selectedPhaseId} onValueChange={setSelectedPhaseId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une phase..." />
              </SelectTrigger>
              <SelectContent>
                {phases?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    Phase {p.index_dans_saison} ({new Date(p.date_debut).toLocaleDateString('fr-FR', { month: 'short' })} - {new Date(p.date_fin).toLocaleDateString('fr-FR', { month: 'short' })})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Coller le texte de la startlist
            </label>
            <Textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="0. MBH NESPOLI Lorenzo 0:00"
              className="min-h-[200px] font-mono text-sm"
            />
          </div>

          <Button onClick={handleParse} disabled={isLoading} className="w-full touch-target">
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
            <div className="space-y-4">
              <KPIRow
                items={[
                  { label: "Lignes", value: parseResult.counts.parsed },
                  { label: "Match DB", value: parseResult.counts.matched_db, trend: "up" },
                  { label: "Dans roster", value: parseResult.counts.on_roster, trend: "up" },
                ]}
              />
              
              {parseResult.counts.unmatched > 0 && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowUnmatched(true)}
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Voir les {parseResult.counts.unmatched} non trouvés
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // VIEW MODE
  if (viewMode === "view") {
    if (viewLoading) {
      return (
        <div className="p-4 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      );
    }

    if (!startlistViewData) {
      return (
        <div className="p-4">
          <Button variant="ghost" onClick={() => setViewMode("list")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          <MobileEmptyState
            icon={<AlertCircle className="h-12 w-12" />}
            title="Erreur"
            description="Impossible de charger la startlist"
          />
        </div>
      );
    }

    return (
      <div className="pb-20">
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setViewMode("list")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            {startlistViewData.pcs_validated && (
              <Badge className="bg-green-600 text-white">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                PCS OK
              </Badge>
            )}
          </div>

          {/* Race info */}
          <div>
            <h2 className="text-xl font-bold">{startlistViewData.race.nom}</h2>
            <p className="text-sm text-muted-foreground">
              {format(new Date(startlistViewData.race.date_debut), "dd MMMM yyyy", { locale: fr })} •{" "}
              {startlistViewData.race.categorie}
            </p>
          </div>

          {/* Section Parcours + Avis - Layout optimisé */}
          <div className="space-y-3">
            {/* Image du parcours - Agrandie */}
            {startlistViewData.route_image_url && (
              <div
                className="rounded-2xl overflow-hidden border-2 cursor-pointer shadow-lg"
                onClick={() => setImageModalOpen(true)}
              >
                <img
                  src={startlistViewData.route_image_url}
                  alt="Parcours"
                  className="w-full h-auto object-cover"
                />
              </div>
            )}

            {/* L'avis du startlisteur - Sans espace vide */}
            {startlistViewData.admin_rating_note?.trim()?.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <h4 className="font-semibold text-sm">L'avis du startlisteur</h4>
                </div>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                  "{startlistViewData.admin_rating_note}"
                  {startlistViewData.admin_rating_author && (
                    <span className="block mt-2 text-xs font-medium text-right italic">
                      — {startlistViewData.admin_rating_author}
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Barème de points - Optimisé pour courses à étapes */}
          {startlistViewData.scoring && startlistViewData.scoring.rules && startlistViewData.scoring.rules.length > 0 && (
            <div className="space-y-2">
              {/* Barème Général */}
              {startlistViewData.scoring.rules.some((r: any) => r.type_classement === 'General') && (
                <div className="bg-muted/50 rounded-xl p-3 border">
                  <h4 className="font-semibold text-xs mb-2">
                    Barème Général ({startlistViewData.scoring.categorie})
                  </h4>
                  <div className="grid grid-cols-5 gap-x-3 gap-y-1 text-xs">
                    {startlistViewData.scoring.rules
                      .filter((r: any) => r.type_classement === 'General')
                      .slice(0, 10)
                      .map((rule: any) => (
                        <div key={`gc-${rule.place}`} className="flex gap-1">
                          <span className="font-medium">{rule.place}e:</span>
                          <span className="text-muted-foreground">{rule.points}pts</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              
              {/* Barème Étapes */}
              {startlistViewData.scoring.rules.some((r: any) => r.type_classement === 'Etape') && (
                <div className="bg-primary/5 rounded-xl p-3 border border-primary/20">
                  <h4 className="font-semibold text-xs mb-2 text-primary">
                    Barème Étapes
                  </h4>
                  <div className="grid grid-cols-5 gap-x-3 gap-y-1 text-xs">
                    {startlistViewData.scoring.rules
                      .filter((r: any) => r.type_classement === 'Etape')
                      .slice(0, 10)
                      .map((rule: any) => (
                        <div key={`stage-${rule.place}`} className="flex gap-1">
                          <span className="font-medium">{rule.place}e:</span>
                          <span className="text-muted-foreground">{rule.points}pts</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Le mot du startlisteur - Dernier */}
          {startlistViewData.startlisteur_note && (
            <div className="bg-muted/30 border border-amber-300/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4 text-amber-500" />
                <h4 className="font-semibold text-sm text-amber-700 dark:text-amber-400">
                  Le mot du startlisteur
                </h4>
              </div>
              <p className="text-base text-foreground/80 whitespace-pre-wrap leading-relaxed">
                {startlistViewData.startlisteur_note}
              </p>
            </div>
          )}

          {/* KPIs */}
          <KPIRow
            items={[
              { label: "Managers", value: startlistViewData.totals.managers, icon: <Users className="h-4 w-4" /> },
              { label: "Partants", value: startlistViewData.totals.starters_all, icon: <Trophy className="h-4 w-4" /> },
            ]}
          />

          {/* Managers */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Managers au départ</h3>
            <div className="space-y-3">
              {startlistViewData.managers.map((manager: any) => {
                const isExpanded = expandedManagers.has(manager.manager_id);
                const sortedStarters = [...manager.starters].sort((a: any, b: any) => (b.cote || 0) - (a.cote || 0));
                const displayedStarters = isExpanded ? sortedStarters : sortedStarters.slice(0, 3);
                const hasMore = manager.starters.length > 3;

                return (
                  <MobileCard
                    key={manager.manager_id}
                    title={manager.manager_nom}
                    subtitle={
                      <div className="space-y-1">
                        <ManagerStars avgStars={manager.avg_stars} votes={manager.votes} showVotes={manager.votes > 1} />
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          <span>Phase: #{manager.rank_phase || "-"}</span>
                          <span>CG: #{manager.rank_total || "-"}</span>
                        </div>
                      </div>
                    }
                    avatar={
                      manager.jersey_image_url ? (
                        <img 
                          src={manager.jersey_image_url} 
                          alt="Maillot" 
                          className="h-20 w-20 object-contain"
                        />
                      ) : (
                        <Avatar className="h-20 w-20">
                          <AvatarFallback className="bg-primary/10">
                            {manager.manager_nom
                              .split(" ")
                              .map((n: string) => n[0])
                              .join("")
                              .slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                      )
                    }
                    badge={
                      <Badge variant="outline" className="text-xs">
                        {manager.starters_count} coureurs
                      </Badge>
                    }
                  >
                    <div className="mt-2 space-y-1">
                      {displayedStarters.map((starter: any) => (
                        <div key={starter.coureur_id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-medium truncate flex-1">{starter.nom}</span>
                        </div>
                      ))}
                      {hasMore && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const newExpanded = new Set(expandedManagers);
                            if (isExpanded) {
                              newExpanded.delete(manager.manager_id);
                            } else {
                              newExpanded.add(manager.manager_id);
                            }
                            setExpandedManagers(newExpanded);
                          }}
                          className="text-xs text-primary font-medium hover:underline w-full text-left"
                        >
                          {isExpanded 
                            ? "Réduire" 
                            : `+${manager.starters.length - 3} autres`}
                        </button>
                      )}
                    </div>
                  </MobileCard>
                );
              })}
            </div>
          </div>

          {/* Sans propriétaire */}
          {startlistViewData.without_owner && startlistViewData.without_owner.length > 0 && (
            <div className="rounded-xl bg-muted/50 p-4">
              <h4 className="font-semibold text-sm mb-2">
                Sans propriétaire ({startlistViewData.without_owner.length})
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {startlistViewData.without_owner.map((coureur: any) => (
                  <Badge key={coureur.coureur_id} variant="outline" className="text-xs">
                    {coureur.nom}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sticky button Noter */}
        {isAdmin && startlistViewData.managers.length > 0 && (
          <MobileStickyBottom>
            <Button className="w-full touch-target" onClick={() => setShowRatingModal(true)}>
              <Star className="h-4 w-4 mr-2" />
              Noter les managers
            </Button>
          </MobileStickyBottom>
        )}

        {/* Modal de notation */}
        {isAdmin && startlistViewData.managers.length > 0 && (
          <ManagerRatingModal 
            open={showRatingModal}
            onOpenChange={setShowRatingModal}
            startlistId={selectedStartlistId!}
            managers={startlistViewData.managers}
            initialGlobalNote={startlistViewData.admin_rating_note || ""}
            onRatingsUpdated={() => queryClient.invalidateQueries({ queryKey: ['startlist-view-mobile', selectedStartlistId] })}
          />
        )}

        {/* Image modal */}
        <MobileBottomSheet
          open={imageModalOpen}
          onOpenChange={setImageModalOpen}
          title="Parcours"
        >
          {startlistViewData.route_image_url && (
            <img
              src={startlistViewData.route_image_url}
              alt="Parcours en grand"
              className="w-full h-auto rounded-lg"
            />
          )}
        </MobileBottomSheet>

        {/* Unmatched sheet */}
        <MobileBottomSheet
          open={showUnmatched}
          onOpenChange={setShowUnmatched}
          title="Coureurs non trouvés"
          description="Ces coureurs n'ont pas été identifiés dans la base"
        >
          <div className="space-y-2">
            {parseResult?.entries
              ?.filter((e: any) => !e.coureur_id)
              .map((entry: any, idx: number) => (
                <div key={idx} className="p-3 rounded-lg bg-muted/50 text-sm">
                  {entry.source_name}
                </div>
              ))}
          </div>
        </MobileBottomSheet>
      </div>
    );
  }

  return null;
};
