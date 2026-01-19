import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Camera, CheckCircle2, Star, Upload } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { toPng } from "html-to-image";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { RouteImageUploader } from "@/components/startlist/RouteImageUploader";
import { ManagerRatingModal } from "@/components/startlist/ManagerRatingModal";
import { StartlistDesktopExport } from "@/components/startlist/StartlistDesktopExport";
import { useLeague } from "@/contexts/LeagueContext";

interface StartlistDetailViewProps {
  startlistId: string;
  onBack: () => void;
  isSuperAdmin: boolean;
  onImport?: () => void;
}

export const StartlistDetailView = ({ startlistId, onBack, isSuperAdmin, onImport }: StartlistDetailViewProps) => {
  const queryClient = useQueryClient();
  const { leagueId } = useLeague();
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  // Load current user
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

  // Fetch startlist view data
  const { data: startlistViewData, isLoading: isLoadingStartlistView } = useQuery({
    queryKey: ['startlist-view', startlistId, isSuperAdmin ? 'superadmin' : leagueId],
    enabled: !!startlistId,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('startlist-manager-view', {
        body: {
          startlist_id: startlistId,
          league_id: isSuperAdmin ? null : leagueId
        }
      });
      
      if (error) throw error;
      
      // Get PCS validation info only (admin_rating_note comes from edge function as league-scoped)
      const { data: startlistData } = await supabase
        .from('startlist_imports')
        .select('pcs_validated, pcs_validated_at, pcs_validated_by_manager_id')
        .eq('id', startlistId)
        .single();
      
      // Load current user for PCS validation
      await loadCurrentUser();
      
      return { ...data, ...startlistData };
    }
  });

  const handlePcsValidation = async () => {
    if (!startlistId || !currentUser) return;
    
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
        .eq('id', startlistId);

      if (error) throw error;

      toast.success(newStatus ? "Startlist validée PCS ✓" : "Validation PCS retirée");
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
        <Button variant="ghost" onClick={onBack} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
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
        <Button variant="ghost" onClick={onBack}>
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
              startlistId={startlistId}
              currentImageUrl={startlistViewData.route_image_url}
              onUploadComplete={() => queryClient.invalidateQueries({ queryKey: ['startlist-view', startlistId] })}
            />
          )}
          {isSuperAdmin && onImport && (
            <Button 
              onClick={onImport} 
              variant="outline"
              size="sm"
            >
              <Upload className="h-4 w-4 mr-2" />
              Importer nouvelle SL
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
        startlistId={startlistId}
        leagueId={leagueId}
        managers={startlistViewData.managers}
        initialGlobalNote={startlistViewData.admin_rating_note || ""}
        onRatingsUpdated={() => queryClient.invalidateQueries({ queryKey: ['startlist-view', startlistId] })}
      />
    </div>
  );
};
