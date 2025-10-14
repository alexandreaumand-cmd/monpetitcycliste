import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { toJpeg } from "html-to-image";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Download, Loader2, Copy, Share2 } from "lucide-react";
import { getJerseyIcon, getJerseyLabel } from "@/lib/exportTemplates";

type ExportScope = "top10" | "top15" | "top20" | "full";

type ExportResultsImageProps = {
  course: {
    course_id: string;
    course_nom: string;
    categorie: string;
    type_course: string;
    date_debut: string;
    date_fin: string;
    nb_etapes: number;
    phase_id: string;
  };
  currentStage?: number;
  currentClassement?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const ExportResultsImage = ({
  course,
  currentStage,
  currentClassement,
  open,
  onOpenChange,
}: ExportResultsImageProps) => {
  const [scope, setScope] = useState<ExportScope>("top15");
  const [isGenerating, setIsGenerating] = useState(false);
  const [exportRef, setExportRef] = useState<HTMLDivElement | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  const isOneDay = course.type_course === "One day";
  const etapeNumero = !isOneDay && currentStage ? currentStage : null;
  // @ts-ignore - Type classement is dynamic from parent
  const typeClassement = currentClassement || "General";

  // Récupération des données
  const { data: topRiders, isLoading: loadingRiders } = useQuery({
    queryKey: ["export-top-riders", course.course_id, typeClassement, etapeNumero, scope],
    queryFn: async () => {
      const limit = scope === "top10" ? 10 : scope === "top15" ? 15 : scope === "top20" ? 20 : 100;
      
      // @ts-ignore - Type classement is dynamic, RPC will validate
      const { data, error } = await supabase.rpc("results_course_top", {
        p_course_id: course.course_id,
        // @ts-ignore
        p_type_classement: typeClassement,
        p_etape_numero: etapeNumero,
        p_limit: limit,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const { data: managerPoints, isLoading: loadingManagers } = useQuery({
    queryKey: ["export-manager-points", course.course_id, typeClassement, etapeNumero],
    queryFn: async () => {
      // @ts-ignore - Type classement is dynamic
      let query = supabase
        .from("points_ledger")
        .select("manager_id, managers!inner(nom), points")
        .eq("course_id", course.course_id)
        // @ts-ignore
        .eq("type_classement", typeClassement)
        .not("manager_id", "is", null);

      if (etapeNumero) {
        query = query.eq("etape_numero", etapeNumero);
      } else {
        query = query.is("etape_numero", null);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Agrégation par manager
      const aggregated = (data || []).reduce((acc: any, row: any) => {
        const managerId = row.manager_id;
        if (!acc[managerId]) {
          acc[managerId] = {
            manager_id: managerId,
            nom: row.managers.nom,
            total_points: 0,
          };
        }
        acc[managerId].total_points += row.points;
        return acc;
      }, {});

      return Object.values(aggregated)
        .sort((a: any, b: any) => b.total_points - a.total_points)
        .slice(0, 3);
    },
    enabled: open,
  });

  const { data: jerseyHolders, isLoading: loadingJerseys } = useQuery({
    queryKey: ["export-jerseys", course.course_id, etapeNumero],
    queryFn: async () => {
      if (isOneDay) return [];

      const { data, error } = await supabase
        .from("race_results")
        .select(
          `
          type_classement,
          coureur_id,
          coureurs!inner(nom),
          manager_id,
          managers(nom)
        `
        )
        .eq("course_id", course.course_id)
        .like("type_classement", "Porteur%")
        .eq("etape_numero", etapeNumero || 1)
        .eq("statut", "finished");

      if (error) throw error;
      return data || [];
    },
    enabled: open && !isOneDay,
  });

  const handleGeneratePreview = async () => {
    if (!exportRef) {
      toast.error("Impossible de générer l'aperçu. Réessayez.");
      return;
    }

    // Vérifier qu'il y a au moins des données à exporter
    const hasData = 
      (topRiders && topRiders.length > 0) ||
      (managerPoints && managerPoints.length > 0) ||
      (jerseyHolders && jerseyHolders.length > 0);

    if (!hasData) {
      toast.error("Aucun résultat disponible pour cette course. Saisissez d'abord les résultats.");
      return;
    }

    try {
      setIsGenerating(true);

      // Petit délai pour s'assurer que le DOM est prêt
      await new Promise((resolve) => setTimeout(resolve, 200));

      const dataUrl = await toJpeg(exportRef, {
        quality: 0.95,
        pixelRatio: 2,
        width: 1080,
        height: 1920,
        cacheBust: true,
        backgroundColor: "#ffffff",
      });

      setGeneratedImageUrl(dataUrl);
      toast.success("Aperçu généré !");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Erreur lors de la génération de l'image");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyImage = async () => {
    if (!generatedImageUrl) return;
    
    // Vérifier si l'API Clipboard est disponible
    if (!navigator.clipboard || !navigator.clipboard.write) {
      toast.info("Copie non supportée. Faites un appui long sur l'image pour la copier.");
      return;
    }
    
    try {
      const response = await fetch(generatedImageUrl);
      const blob = await response.blob();
      // Créer un blob JPEG explicite (toJpeg génère du JPEG, pas du PNG)
      const jpegBlob = new Blob([blob], { type: 'image/jpeg' });
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/jpeg': jpegBlob })
      ]);
      toast.success("Image copiée dans le presse-papiers !");
    } catch (error) {
      console.error('Error copying image:', error);
      toast.error("Échec de la copie. Essayez de télécharger l'image.");
    }
  };

  const handleShareImage = async () => {
    if (!generatedImageUrl) return;
    
    try {
      const response = await fetch(generatedImageUrl);
      const blob = await response.blob();
      const file = new File([blob], `export_${course.course_nom.replace(/[^a-z0-9]/gi, "_")}.jpg`, { type: 'image/jpeg' });
      
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Résultats ${course.course_nom}`,
          text: `🏁 ${course.course_nom} - ${typeClassement}${etapeNumero ? ` Étape ${etapeNumero}` : ''}`,
        });
        toast.success("Image partagée !");
      } else {
        toast.info("Partage non supporté. Téléchargez l'image.");
      }
    } catch (error) {
      console.error('Error sharing image:', error);
      toast.error("Échec du partage.");
    }
  };

  const handleDownload = () => {
    if (!generatedImageUrl) return;
    
    const link = document.createElement("a");
    const courseName = course.course_nom.replace(/[^a-z0-9]/gi, "_");
    const type = etapeNumero ? `Etape${etapeNumero}` : typeClassement;
    const date = format(new Date(course.date_fin || course.date_debut), "yyyy-MM-dd");
    link.download = `${courseName}_${type}_${date}.jpg`;
    link.href = generatedImageUrl;
    link.click();
    toast.success("Image téléchargée !");
  };

  const handleReset = () => {
    setGeneratedImageUrl(null);
  };

  const isLoading = loadingRiders || loadingManagers || loadingJerseys;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>📤 Partager les résultats</DialogTitle>
          </DialogHeader>

          {!generatedImageUrl ? (
            <>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Portée de l'export</Label>
                  <RadioGroup value={scope} onValueChange={(v) => setScope(v as ExportScope)}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="top10" id="top10" />
                      <Label htmlFor="top10" className="font-normal cursor-pointer">
                        Top 10 (compact)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="top15" id="top15" />
                      <Label htmlFor="top15" className="font-normal cursor-pointer">
                        Top 15 (courses d'un jour)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="top20" id="top20" />
                      <Label htmlFor="top20" className="font-normal cursor-pointer">
                        Top 20 (courses par étapes)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="full" id="full" />
                      <Label htmlFor="full" className="font-normal cursor-pointer">
                        Complet (tous les coureurs)
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Format: 1080 x 1920 (WhatsApp)</p>
                  <p>Qualité: Haute (JPEG 95%)</p>
                </div>

                {isLoading && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                  Annuler
                </Button>
                <Button
                  onClick={handleGeneratePreview}
                  disabled={isLoading || isGenerating}
                  className="flex-1"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Génération...
                    </>
                  ) : (
                    "Générer l'aperçu"
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-4 py-4">
                <div className="bg-muted rounded-lg p-4 max-h-[500px] overflow-auto flex items-center justify-center">
                  <img 
                    src={generatedImageUrl} 
                    alt="Aperçu de l'export" 
                    className="max-w-full h-auto rounded shadow-lg"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  onClick={handleReset}
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  Modifier options
                </Button>
                <Button 
                  onClick={handleCopyImage}
                  variant="secondary"
                  className="flex-1 sm:hidden"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copier
                </Button>
                <Button 
                  onClick={handleShareImage}
                  variant="secondary"
                  className="flex-1 sm:hidden"
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Partager
                </Button>
                <Button 
                  onClick={handleCopyImage}
                  variant="secondary"
                  className="hidden sm:flex flex-1"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copier l'image
                </Button>
                <Button 
                  onClick={handleDownload}
                  className="flex-1"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Télécharger
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Template HTML pour génération (caché) */}
      <div style={{ position: "fixed", left: "-9999px", top: 0 }}>
        <div
          ref={setExportRef}
          style={{
            width: "1080px",
            height: "1920px",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            padding: "40px",
            fontFamily: "Inter, Arial, sans-serif",
            boxSizing: "border-box",
          }}
        >
          {/* HEADER */}
          <div style={{ textAlign: "center", color: "white", marginBottom: "40px" }}>
            <div style={{ fontSize: "64px", marginBottom: "10px" }}>🏆</div>
            <h1 style={{ fontSize: "48px", margin: "10px 0", fontWeight: "bold" }}>
              {course.course_nom}
            </h1>
            <p style={{ fontSize: "28px", opacity: 0.9, margin: "5px 0" }}>
              {course.categorie} • {typeClassement}
              {etapeNumero && ` Étape ${etapeNumero}`}
            </p>
            <p style={{ fontSize: "22px", opacity: 0.8 }}>
              {format(new Date(course.date_fin || course.date_debut), "dd MMMM yyyy", {
                locale: fr,
              })}
            </p>
          </div>

          {/* TOP COUREURS */}
          {topRiders && topRiders.length > 0 && (
            <div
              style={{
                background: "white",
                borderRadius: "20px",
                padding: "30px",
                marginBottom: "30px",
              }}
            >
              <h2 style={{ fontSize: "36px", marginBottom: "20px", fontWeight: "bold" }}>
                🚴 Top {scope === "top10" ? "10" : scope === "top15" ? "15" : scope === "top20" ? "20" : ""} Coureurs
              </h2>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                    <th style={{ textAlign: "left", padding: "12px", fontSize: "20px" }}>Pos</th>
                    <th style={{ textAlign: "left", padding: "12px", fontSize: "20px" }}>
                      Coureur
                    </th>
                    <th style={{ textAlign: "left", padding: "12px", fontSize: "20px" }}>Équipe</th>
                    <th style={{ textAlign: "left", padding: "12px", fontSize: "20px" }}>
                      Manager
                    </th>
                    <th style={{ textAlign: "right", padding: "12px", fontSize: "20px" }}>
                      Points
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topRiders.map((rider: any, idx: number) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: "1px solid #f3f4f6",
                        background:
                          idx < 3
                            ? idx === 0
                              ? "#FFF9E6"
                              : idx === 1
                                ? "#F5F5F5"
                                : "#FFF5E6"
                            : "white",
                      }}
                    >
                      <td style={{ padding: "16px", fontSize: "24px", fontWeight: "bold" }}>
                        {idx < 3
                          ? idx === 0
                            ? "🥇"
                            : idx === 1
                              ? "🥈"
                              : "🥉"
                          : rider.row_position}
                      </td>
                      <td style={{ padding: "16px", fontSize: "20px", fontWeight: "600" }}>
                        {rider.coureur_nom}
                      </td>
                      <td style={{ padding: "16px", fontSize: "18px", color: "#6b7280" }}>
                        {rider.equipe}
                      </td>
                      <td style={{ padding: "16px", fontSize: "18px", color: "#6b7280" }}>
                        {rider.manager_nom || "-"}
                      </td>
                      <td
                        style={{
                          padding: "16px",
                          fontSize: "22px",
                          fontWeight: "bold",
                          textAlign: "right",
                        }}
                      >
                        {rider.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* PODIUM MANAGERS */}
          {managerPoints && managerPoints.length > 0 && (
            <div
              style={{
                background: "white",
                borderRadius: "20px",
                padding: "30px",
                marginBottom: "30px",
              }}
            >
              <h2 style={{ fontSize: "36px", marginBottom: "20px", fontWeight: "bold" }}>
                👔 Podium Managers
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px" }}>
                {managerPoints.slice(0, 3).map((manager: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      textAlign: "center",
                      padding: "20px",
                      background:
                        idx === 0 ? "#FFF9E6" : idx === 1 ? "#F5F5F5" : "#FFF5E6",
                      borderRadius: "15px",
                    }}
                  >
                    <div style={{ fontSize: "48px" }}>
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}
                    </div>
                    <p style={{ fontSize: "24px", fontWeight: "bold", margin: "10px 0" }}>
                      {manager.nom}
                    </p>
                    <p style={{ fontSize: "28px", fontWeight: "bold", color: "#667eea" }}>
                      {manager.total_points} pts
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PORTEURS DE MAILLOTS */}
          {!isOneDay && jerseyHolders && jerseyHolders.length > 0 && (
            <div
              style={{
                background: "white",
                borderRadius: "20px",
                padding: "30px",
                marginBottom: "30px",
              }}
            >
              <h2 style={{ fontSize: "36px", marginBottom: "20px", fontWeight: "bold" }}>
                🎽 Porteurs de Maillots
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                {jerseyHolders.map((jersey: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      padding: "15px",
                      background: "#f9fafb",
                      borderRadius: "10px",
                      display: "flex",
                      alignItems: "center",
                      gap: "15px",
                    }}
                  >
                    <span style={{ fontSize: "32px" }}>
                      {getJerseyIcon(jersey.type_classement)}
                    </span>
                    <div>
                      <p style={{ fontSize: "16px", color: "#6b7280" }}>
                        {getJerseyLabel(jersey.type_classement)}
                      </p>
                      <p style={{ fontSize: "20px", fontWeight: "600" }}>
                        {jersey.coureurs.nom}
                      </p>
                      <p style={{ fontSize: "16px", color: "#9ca3af" }}>
                        {jersey.managers?.nom || "Aucun manager"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FOOTER */}
          <div style={{ textAlign: "center", color: "white", marginTop: "40px" }}>
            <p style={{ fontSize: "18px", opacity: 0.8 }}>
              Généré le {format(new Date(), "dd/MM/yyyy à HH:mm", { locale: fr })}
            </p>
          </div>
        </div>
      </div>
    </>
  );
};
