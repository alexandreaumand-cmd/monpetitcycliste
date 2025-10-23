import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Trophy, Medal, Filter, Flag } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

type RiderResult = {
  position: number;
  coureur_nom: string;
  coureur_equipe?: string;
  points: number;
};

type RaceWithResults = {
  course_id: string;
  course_nom: string;
  date_fin: string;
  total_points: number;
  top10: RiderResult[];
  types_disponibles: string[];
  etapes_disponibles: number[];
};

type ClassificationResult = {
  [key: string]: RiderResult[];
};

function RaceCard({ race }: { race: RaceWithResults }) {
  const [activeTab, setActiveTab] = useState<'general' | 'stages'>('general');
  const [selectedClassificationType, setSelectedClassificationType] = useState<string>('General');
  const [selectedStage, setSelectedStage] = useState<number>(race.etapes_disponibles?.[0] ?? 1);
  const [loadedClassifications, setLoadedClassifications] = useState<ClassificationResult>({
    General: race.top10
  });
  const [isLoadingTab, setIsLoadingTab] = useState(false);

  const loadClassification = async (type: string, etape?: number) => {
    const key = etape ? `${type}-${etape}` : type;
    
    if (loadedClassifications[key]) {
      return;
    }

    setIsLoadingTab(true);
    try {
      const { data, error } = await supabase.rpc('results_course_top', {
        p_course_id: race.course_id,
        p_type_classement: type as any,
        p_etape_numero: etape || null,
        p_limit: 10
      });

      if (error) throw error;
      
      const formattedData: RiderResult[] = (data || []).map((r: any) => ({
        position: r.row_position || r.position || 0,
        coureur_nom: r.coureur_nom || '',
        coureur_equipe: r.equipe || '',
        points: r.points || 0
      }));
      
      setLoadedClassifications(prev => ({
        ...prev,
        [key]: formattedData
      }));
    } catch (error) {
      console.error('Error loading classification:', error);
    } finally {
      setIsLoadingTab(false);
    }
  };

  const handleTabChange = async (tab: 'general' | 'stages') => {
    setActiveTab(tab);
    if (tab === 'stages') {
      const key = `Etape-${selectedStage}`;
      if (!loadedClassifications[key]) {
        await loadClassification('Etape', selectedStage);
      }
    }
  };

  const handleClassificationChange = async (value: string) => {
    setSelectedClassificationType(value);
    if (!loadedClassifications[value]) {
      await loadClassification(value);
    }
  };

  const handleStageChange = async (value: string) => {
    const stageNum = parseInt(value);
    setSelectedStage(stageNum);
    const key = `Etape-${stageNum}`;
    if (!loadedClassifications[key]) {
      await loadClassification('Etape', stageNum);
    }
  };

  const getCurrentKey = () => {
    if (activeTab === 'stages') {
      return `Etape-${selectedStage}`;
    }
    return selectedClassificationType;
  };

  const currentResults = loadedClassifications[getCurrentKey()] || [];
  const hasMultipleStages = (race.etapes_disponibles?.length ?? 0) > 0;
  const availableTypes = (race.types_disponibles || []).filter(t => t !== 'General');

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="space-y-1">
          <h4 className="font-bold text-base leading-tight">{race.course_nom}</h4>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {race.date_fin ? format(new Date(race.date_fin), 'dd MMMM yyyy', { locale: fr }) : 'Date inconnue'}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {availableTypes.length > 0 || hasMultipleStages ? (
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-3">
              <TabsTrigger value="general">
                <Filter className="h-3 w-3 mr-1" />
                Général
              </TabsTrigger>
              {hasMultipleStages && (
                <TabsTrigger value="stages">
                  <Flag className="h-3 w-3 mr-1" />
                  Étapes
                </TabsTrigger>
              )}
            </TabsList>
            
            <TabsContent value="general" className="mt-0">
              <div className="mb-3">
                <Select value={selectedClassificationType} onValueChange={handleClassificationChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Type de classement" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="General">🏆 Classement Général</SelectItem>
                    {availableTypes.includes('Points') && (
                      <SelectItem value="Points">🟢 Points</SelectItem>
                    )}
                    {availableTypes.includes('Montagne') && (
                      <SelectItem value="Montagne">⛰️ Pois (Montagne)</SelectItem>
                    )}
                    {availableTypes.includes('Jeune') && (
                      <SelectItem value="Jeune">👶 Jeunes</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              {isLoadingTab ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <RidersList riders={currentResults} />
              )}
            </TabsContent>

            {hasMultipleStages && (
              <TabsContent value="stages" className="mt-0">
                <div className="mb-3">
                  <Select value={selectedStage.toString()} onValueChange={handleStageChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sélectionner une étape" />
                    </SelectTrigger>
                    <SelectContent>
                      {race.etapes_disponibles.map((etape) => (
                        <SelectItem key={etape} value={etape.toString()}>
                          🚩 Étape {etape}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {isLoadingTab ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <RidersList riders={currentResults} />
                )}
              </TabsContent>
            )}
          </Tabs>
        ) : (
          <RidersList riders={currentResults} />
        )}
      </CardContent>
    </Card>
  );
}

function RidersList({ riders }: { riders: RiderResult[] }) {
  const getMedalIcon = (position: number) => {
    if (position === 1) return <Medal className="h-4 w-4 text-yellow-500 fill-yellow-500" />;
    if (position === 2) return <Medal className="h-4 w-4 text-gray-400 fill-gray-400" />;
    if (position === 3) return <Medal className="h-4 w-4 text-amber-600 fill-amber-600" />;
    return null;
  };

  const getPodiumStyles = (position: number) => {
    if (position === 1) {
      return "bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border-l-4 border-yellow-400";
    }
    if (position === 2) {
      return "bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800/20 dark:to-gray-700/20 border-l-4 border-gray-400";
    }
    if (position === 3) {
      return "bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border-l-4 border-amber-600";
    }
    return "";
  };

  if (riders.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic text-center py-4">
        Pas encore de résultats
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {riders.map((rider) => (
        <div
          key={`${rider.position}-${rider.coureur_nom}`}
          className={cn(
            "flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors",
            rider.position <= 3 
              ? getPodiumStyles(rider.position)
              : "hover:bg-muted/30"
          )}
        >
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="flex items-center justify-center w-5 flex-shrink-0">
              {getMedalIcon(rider.position) || (
                <span className="text-muted-foreground font-medium text-sm">
                  {rider.position}
                </span>
              )}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className={cn(
                "truncate",
                rider.position <= 3 ? "font-semibold text-sm" : "font-medium text-xs"
              )}>
                {rider.coureur_nom}
              </span>
              {rider.coureur_equipe && rider.position <= 3 && (
                <span className="text-xs text-muted-foreground truncate">
                  {rider.coureur_equipe}
                </span>
              )}
            </div>
          </div>
          <span className={cn(
            "flex-shrink-0 ml-2 tabular-nums",
            rider.position <= 3 
              ? "font-bold text-sm text-primary" 
              : "font-semibold text-xs text-muted-foreground"
          )}>
            {rider.points}
          </span>
        </div>
      ))}
    </div>
  );
}

export function RecentResultsWidget() {
  const { data: racesWithResults, isLoading } = useQuery({
    queryKey: ['recent-results-top10'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('home-recent-results-top10', {
        body: { limit: 3 }
      });

      if (error) throw error;
      return data.races as RaceWithResults[];
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Derniers résultats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((j) => (
                    <Skeleton key={j} className="h-12 w-full" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!racesWithResults || racesWithResults.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Derniers résultats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Aucun résultat récent
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Derniers résultats
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {racesWithResults.map((race) => (
            <RaceCard key={race.course_id} race={race} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
