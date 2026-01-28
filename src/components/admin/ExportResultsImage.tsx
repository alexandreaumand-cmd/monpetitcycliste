import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  leagueName?: string;
};

export const ExportResultsImage = ({
  course,
  currentStage,
  currentClassement,
  open,
  onOpenChange,
  leagueName,
}: ExportResultsImageProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [exportRef, setExportRef] = useState<HTMLDivElement | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  const isOneDay = course.type_course === "One day";
  const etapeNumero = !isOneDay && currentStage ? currentStage : null;
  // @ts-ignore - Type classement is dynamic from parent
  const typeClassement = currentClassement || "General";

  // Récupérer le scope automatiquement depuis le barème
  const { data: maxPlace, isLoading: loadingBareme } = useQuery({
    queryKey: ["export-bareme-scope", course.course_id, typeClassement],
    queryFn: async () => {
      // 1. Récupérer la catégorie canonique et la saison
      const { data: courseInfo } = await supabase
        .from("courses")
        .select("categorie, phase_id, phases(saison_id)")
        .eq("id", course.course_id)
        .maybeSingle();
      
      if (!courseInfo) return 15; // Fallback
      
      const { data: normData } = await supabase
        .from("courses_for_points_norm")
        .select("cat_canon")
        .eq("id", course.course_id)
        .maybeSingle();
      
      const categorie = normData?.cat_canon || courseInfo.categorie;
      const saisonId = (courseInfo.phases as any)?.saison_id;
      
      if (!saisonId || !categorie) return 15; // Fallback
      
      // 2. Récupérer le max de places du barème
      // @ts-ignore - typeClassement might not match the exact enum type
      const { data: bareme } = await supabase
        .from("scoring_rules_saisons")
        .select("place")
        .ilike("categorie", categorie)
        .eq("type_classement", typeClassement as any)
        .eq("saison_id", saisonId)
        .order("place", { ascending: false })
        .limit(1);
      
      return bareme?.[0]?.place || 15; // Fallback 15 si pas de barème
    },
    enabled: open,
  });

  // Dériver le scope depuis le nombre de places du barème
  const scope: ExportScope = useMemo(() => {
    const places = maxPlace || 15;
    
    if (places <= 10) return "top10";
    if (places <= 15) return "top15";
    if (places <= 20) return "top20";
    return "full";
  }, [maxPlace]);

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
    enabled: open && !loadingBareme,
  });


  const { data: jerseyHolders, isLoading: loadingJerseys } = useQuery({
    queryKey: ["export-jerseys", course.course_id, etapeNumero],
    queryFn: async () => {
      if (isOneDay) return [];

      // Appeler l'edge function qui récupère correctement les porteurs
      const { data, error } = await supabase.functions.invoke("stage-jersey-bonuses", {
        body: {
          course_id: course.course_id,
          etape_numero: etapeNumero || 1,
        },
      });

      if (error) throw error;

      // L'edge function retourne { bonuses: [...] } avec coureur_nom, manager_nom
      return (data?.bonuses || []).map((jersey: any) => ({
        type_classement: `Porteur ${jersey.jersey_type.charAt(0).toUpperCase() + jersey.jersey_type.slice(1)}`,
        icon: jersey.icon,
        coureurs: { nom: jersey.coureur_nom },
        managers: { nom: jersey.manager_nom || null },
      }));
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
      toast.info("Faites un appui long sur l'image pour la copier, ou utilisez 'Télécharger'.");
      return;
    }
    
    // Vérifier si ClipboardItem est disponible
    if (!window.ClipboardItem) {
      toast.info("Copie non supportée sur ce navigateur. Utilisez le bouton 'Télécharger'.");
      return;
    }
    
    try {
      const response = await fetch(generatedImageUrl);
      const blob = await response.blob();
      
      // Convertir JPEG en PNG pour meilleure compatibilité clipboard
      const img = new Image();
      img.src = URL.createObjectURL(blob);
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Canvas context unavailable');
      }
      
      ctx.drawImage(img, 0, 0);
      
      const pngBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Failed to create blob'));
          },
          'image/png'
        );
      });
      
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': pngBlob })
      ]);
      
      // Nettoyer
      URL.revokeObjectURL(img.src);
      
      toast.success("Image copiée dans le presse-papiers !");
    } catch (error: any) {
      console.error('Error copying image:', error);
      
      if (error.name === 'NotAllowedError') {
        toast.error("Permission refusée. Autorisez l'accès au presse-papiers dans votre navigateur.");
      } else if (error.name === 'NotSupportedError') {
        toast.info("Copie non supportée sur ce navigateur. Utilisez le bouton 'Télécharger'.");
      } else {
        toast.error("Échec de la copie. Utilisez 'Télécharger' à la place.");
      }
    }
  };

  const handleShareImage = async () => {
    if (!generatedImageUrl) return;
    
    try {
      const response = await fetch(generatedImageUrl);
      const blob = await response.blob();
      const file = new File(
        [blob], 
        `resultats_${course.course_nom.replace(/[^a-z0-9]/gi, "_")}_${etapeNumero ? `etape${etapeNumero}` : typeClassement}.jpg`, 
        { type: 'image/jpeg' }
      );
      
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Résultats ${course.course_nom}`,
          text: `🏁 ${course.course_nom} - ${typeClassement}${etapeNumero ? ` Étape ${etapeNumero}` : ''}`,
        });
        toast.success("Image partagée !");
      } else {
        // Fallback : téléchargement automatique
        handleDownload();
        toast.info("Partage non supporté. Image téléchargée.");
      }
    } catch (error: any) {
      // Si l'utilisateur annule le partage, ne pas afficher d'erreur
      if (error.name === 'AbortError') {
        console.log('Partage annulé par l\'utilisateur');
        return;
      }
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

  const isLoading = loadingRiders || loadingJerseys || loadingBareme;

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
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>
                    Top {scope === "top10" ? "10" : scope === "top15" ? "15" : scope === "top20" ? "20" : "complet"} coureurs
                    {" "}(basé sur le barème {typeClassement})
                  </p>
                  <p>Format: 1080 x 1920 (WhatsApp)</p>
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
                  onClick={handleShareImage}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white sm:hidden"
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Partager
                </Button>
                <Button 
                  onClick={handleDownload}
                  variant="outline"
                  className="flex-1 sm:hidden"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Télécharger
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
                  className="hidden sm:flex flex-1"
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
            <p style={{ fontSize: "24px", fontWeight: "bold", opacity: 0.9 }}>
              {leagueName || "Mon Petit Cycliste"}
            </p>
          </div>
        </div>
      </div>
    </>
  );
};
