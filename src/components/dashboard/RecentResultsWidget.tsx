import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Trophy, Medal, Filter, Flag } from "lucide-react";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
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
  const { t, i18n } = useTranslation('dashboard');
  
  // Determine default tab: if General has no results but stages are available, default to stages
  const hasGeneralResults = race.top10 && race.top10.length > 0;
  const stagesAvailable = (race.etapes_disponibles?.length ?? 0) > 0;
  const latestStage = stagesAvailable 
    ? Math.max(...race.etapes_disponibles) 
    : 1;
  
  // Default to stages tab with latest stage if general has no results
  const defaultTab = (!hasGeneralResults && stagesAvailable) ? 'stages' : 'general';
  
  const [activeTab, setActiveTab] = useState<'general' | 'stages'>(defaultTab);
  const [selectedClassificationType, setSelectedClassificationType] = useState<string>('General');
  const [selectedStage, setSelectedStage] = useState<number>(latestStage);
  const [loadedClassifications, setLoadedClassifications] = useState<ClassificationResult>({
    General: race.top10
  });
  const [isLoadingTab, setIsLoadingTab] = useState(false);
  const dateLocale = i18n.language === 'fr' ? fr : enUS;

  // Load the latest stage results on mount if defaulting to stages tab
  useEffect(() => {
    if (defaultTab === 'stages' && !loadedClassifications[`Etape-${latestStage}`]) {
      loadClassificationData('Etape', latestStage);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadClassificationData = async (type: string, etape?: number) => {
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
        position: r.position,
        coureur_nom: r.coureur_nom || '',
        coureur_equipe: r.coureur_equipe || '',
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
        await loadClassificationData('Etape', selectedStage);
      }
    }
  };

  const handleClassificationChange = async (value: string) => {
    setSelectedClassificationType(value);
    if (!loadedClassifications[value]) {
      await loadClassificationData(value);
    }
  };

  const handleStageChange = async (value: string) => {
    const stageNum = parseInt(value);
    setSelectedStage(stageNum);
    const key = `Etape-${stageNum}`;
    if (!loadedClassifications[key]) {
      await loadClassificationData('Etape', stageNum);
    }
  };

  const getCurrentKey = () => {
    if (activeTab === 'stages') {
      return `Etape-${selectedStage}`;
    }
    return selectedClassificationType;
  };

  const currentResults = loadedClassifications[getCurrentKey()] || [];
  const availableTypes = (race.types_disponibles || []).filter(t => t !== 'General');

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="space-y-1">
          <h4 className="font-bold text-base leading-tight">{race.course_nom}</h4>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {race.date_fin ? format(new Date(race.date_fin), 'dd MMMM yyyy', { locale: dateLocale }) : t('recentResults.unknownDate')}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {availableTypes.length > 0 || stagesAvailable ? (
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-3">
              <TabsTrigger value="general">
                <Filter className="h-3 w-3 mr-1" />
                {t('recentResults.general')}
              </TabsTrigger>
              {stagesAvailable && (
                <TabsTrigger value="stages">
                  <Flag className="h-3 w-3 mr-1" />
                  {t('recentResults.stages')}
                </TabsTrigger>
              )}
            </TabsList>
            
            <TabsContent value="general" className="mt-0">
              <div className="mb-3">
                <Select value={selectedClassificationType} onValueChange={handleClassificationChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('recentResults.classificationPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="General">🏆 {t('recentResults.generalClassification')}</SelectItem>
                    {availableTypes.includes('Points') && (
                      <SelectItem value="Points">🟢 {t('recentResults.pointsClassification')}</SelectItem>
                    )}
                    {availableTypes.includes('Montagne') && (
                      <SelectItem value="Montagne">⛰️ {t('recentResults.mountainClassification')}</SelectItem>
                    )}
                    {availableTypes.includes('Jeune') && (
                      <SelectItem value="Jeune">👶 {t('recentResults.youthClassification')}</SelectItem>
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

            {stagesAvailable && (
              <TabsContent value="stages" className="mt-0">
                <div className="mb-3">
                  <Select value={selectedStage.toString()} onValueChange={handleStageChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('recentResults.stagePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {race.etapes_disponibles.map((etape) => (
                        <SelectItem key={etape} value={etape.toString()}>
                          🚩 {t('recentResults.stage')} {etape}
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
  const { t } = useTranslation('dashboard');
  
  const getMedalIcon = (position: number) => {
    if (position === 1) return <Medal className="h-4 w-4 text-[#FFD500] fill-[#FFD500]" />;
    if (position === 2) return <Medal className="h-4 w-4 text-gray-500 fill-gray-500" />;
    if (position === 3) return <Medal className="h-4 w-4 text-gray-700 fill-gray-700" />;
    return null;
  };

  const getPodiumStyles = (position: number) => {
    if (position === 1) {
      return "bg-[#FFD500] border-l-4 border-black";
    }
    if (position === 2) {
      return "bg-gray-200 dark:bg-gray-800 border-l-4 border-gray-500";
    }
    if (position === 3) {
      return "bg-gray-300 dark:bg-gray-700 border-l-4 border-gray-600";
    }
    return "";
  };

  if (riders.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic text-center py-4">
        {t('recentResults.noResultsYet')}
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
            rider.position === 1
              ? "font-bold text-sm text-black"
              : rider.position <= 3
                ? "font-bold text-sm text-muted-foreground"
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
  const { t } = useTranslation('dashboard');
  
  const { data: racesWithResults, isLoading } = useQuery({
    queryKey: ['recent-results-top10'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('home-recent-results-top10', {
        body: { limit: 6 }
      });

      if (error) throw error;
      return data.races as RaceWithResults[];
    },
    staleTime: 60000, // Cache for 1 minute
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            {t('recentResults.title')}
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
            {t('recentResults.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            {t('recentResults.noResults')}
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
          {t('recentResults.title')}
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
