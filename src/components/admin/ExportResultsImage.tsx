import { useState, useMemo, useEffect } from "react";
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
  leagueId?: string;
};

export const ExportResultsImage = ({
  course,
  currentStage,
  currentClassement,
  open,
  onOpenChange,
  leagueName,
  leagueId,
}: ExportResultsImageProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [exportRef, setExportRef] = useState<HTMLDivElement | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  // Reset l'image générée quand le dialog s'ouvre pour forcer un nouveau rendu
  useEffect(() => {
    if (open) {
      setGeneratedImageUrl(null);
    }
  }, [open]);

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

  // Récupération des données via edge function (inclut manager_nom filtré par ligue)
  const { data: topRiders, isLoading: loadingRiders } = useQuery({
    queryKey: ["export-top-riders", course.course_id, typeClassement, etapeNumero, scope, leagueId],
    queryFn: async () => {
      const limit = scope === "top10" ? 10 : scope === "top15" ? 15 : scope === "top20" ? 20 : 100;
      
      const { data, error } = await supabase.functions.invoke("results-course-table", {
        body: {
          course_id: course.course_id,
          type_classement: typeClassement,
          etape_numero: etapeNumero,
          league_id: leagueId || null
        }
      });
      
      if (error) throw error;
      
      // Transformer et limiter les résultats
      return (data?.rows || [])
        .filter((r: any) => r.row_position !== null)
        .slice(0, limit)
        .map((r: any) => ({
          row_position: r.row_position,
          coureur_nom: r.coureur_nom,
          equipe: r.equipe,
          manager_nom: r.manager_nom,
          points: r.points_officiels ?? r.points_theoriques ?? 0
        }));
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
        points: jersey.points,
      }));
    },
    enabled: open && !isOneDay,
  });

  // Query pour le classement des managers sur la course (2 requêtes séparées + agrégation JS)
  const { data: managerRanking, isLoading: loadingManagerRanking } = useQuery({
    queryKey: ["export-manager-ranking", course.course_id, etapeNumero, leagueId],
    queryFn: async () => {
      // 1. Récupérer tous les points de la course
      let pointsQuery = supabase
        .from('points_ledger')
        .select('coureur_id, points, etape_numero')
        .eq('course_id', course.course_id);
      
      if (etapeNumero) {
        pointsQuery = pointsQuery.lte('etape_numero', etapeNumero);
      }
      
      const { data: pointsData, error: pointsError } = await pointsQuery;
      if (pointsError) throw pointsError;
      
      // 2. Récupérer tous les rosters de la phase/league avec manager
      let rostersQuery = supabase
        .from('rosters')
        .select('coureur_id, manager_id, managers!inner(nom)')
        .eq('phase_id', course.phase_id);
      
      if (leagueId) {
        rostersQuery = rostersQuery.eq('league_id', leagueId);
      }
      
      const { data: rostersData, error: rostersError } = await rostersQuery;
      if (rostersError) throw rostersError;
      
      // 3. Créer une map coureur -> manager
      const coureurToManager = new Map<string, { managerId: string; managerNom: string }>();
      for (const r of rostersData || []) {
        if (r.coureur_id && r.manager_id) {
          coureurToManager.set(r.coureur_id, {
            managerId: r.manager_id,
            managerNom: (r.managers as any)?.nom || 'Inconnu'
          });
        }
      }
      
      // 4. Agréger les points par manager
      const managerTotals = new Map<string, { nom: string; total: number }>();
      for (const p of pointsData || []) {
        const mgr = coureurToManager.get(p.coureur_id);
        if (mgr) {
          const current = managerTotals.get(mgr.managerId) || { nom: mgr.managerNom, total: 0 };
          current.total += p.points;
          managerTotals.set(mgr.managerId, current);
        }
      }
      
      // 5. Trier et retourner top 10
      return Array.from(managerTotals.entries())
        .map(([id, { nom, total }]) => ({ manager_id: id, manager_nom: nom, total_points: total }))
        .sort((a, b) => b.total_points - a.total_points)
        .slice(0, 10);
    },
    enabled: open && !!leagueId,
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
        skipFonts: true,
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

  const isLoading = loadingRiders || loadingJerseys || loadingBareme || loadingManagerRanking;

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
                  <p>Format: 1080 x 1920 (story, idéal partage)</p>
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

      {/* Template HTML pour génération (caché) - Design épuré */}
      <div style={{ position: "fixed", left: "-9999px", top: 0 }}>
        <div
          ref={setExportRef}
          style={{
            width: "1080px",
            height: "1920px",
            background: "#ffffff",
            padding: "40px",
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
            boxSizing: "border-box",
            position: "relative",
          }}
        >
          {/* HEADER */}
          <div style={{ 
            textAlign: "center", 
            marginBottom: "40px",
            borderBottom: "3px solid #FFD500",
            paddingBottom: "25px"
          }}>
            <h1 style={{ fontSize: "56px", margin: "0 0 12px 0", fontWeight: "bold", color: "#1a1a1a" }}>
              {course.course_nom}
            </h1>
            <p style={{ fontSize: "28px", color: "#6b7280", margin: "6px 0" }}>
              {course.categorie} • {typeClassement}{etapeNumero && ` • Étape ${etapeNumero}`}
            </p>
            <p style={{ fontSize: "24px", color: "#9ca3af", margin: 0 }}>
              {format(new Date(course.date_fin || course.date_debut), "dd MMMM yyyy", {
                locale: fr,
              })}
            </p>
          </div>

          {/* CLASSEMENT */}
          {topRiders && topRiders.length > 0 && (
            <div style={{ marginBottom: "40px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #FFD500", background: "#f9fafb" }}>
                    <th style={{ textAlign: "left", padding: "16px 20px", fontSize: "24px", fontWeight: "600" }}>#</th>
                    <th style={{ textAlign: "left", padding: "16px 20px", fontSize: "24px", fontWeight: "600" }}>Coureur</th>
                    <th style={{ textAlign: "left", padding: "16px 20px", fontSize: "24px", fontWeight: "600" }}>Manager</th>
                    <th style={{ textAlign: "right", padding: "16px 20px", fontSize: "24px", fontWeight: "600" }}>Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {topRiders.map((rider: any, idx: number) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: "1px solid #e5e7eb",
                        background: idx % 2 === 0 ? "#ffffff" : "#fafafa",
                      }}
                    >
                      <td style={{ padding: "16px 20px", fontSize: "28px", fontWeight: "bold" }}>
                        {idx < 3
                          ? idx === 0
                            ? "🥇"
                            : idx === 1
                              ? "🥈"
                              : "🥉"
                          : rider.row_position}
                      </td>
                      <td style={{ padding: "16px 20px", fontSize: "26px", fontWeight: "500" }}>
                        {rider.coureur_nom}
                      </td>
                      <td style={{ padding: "16px 20px", fontSize: "24px", color: "#6b7280" }}>
                        {rider.manager_nom || "-"}
                      </td>
                      <td style={{ padding: "16px 20px", fontSize: "26px", fontWeight: "bold", textAlign: "right" }}>
                        {rider.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* POINTS MAILLOTS - Avec coureur et manager */}
          {!isOneDay && jerseyHolders && jerseyHolders.length > 0 && (
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
              fontSize: "16px",
              color: "#6b7280",
              marginTop: "20px",
            }}>
              {jerseyHolders.map((jersey: any, idx: number) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "20px" }}>{jersey.icon}</span>
                  <span style={{ fontWeight: "500" }}>{jersey.coureurs?.nom || "—"}</span>
                  {jersey.managers?.nom && (
                    <span style={{ color: "#9ca3af" }}>({jersey.managers.nom})</span>
                  )}
                  <span style={{ fontWeight: "bold" }}>{jersey.points} pts</span>
                </div>
              ))}
            </div>
          )}

          {/* CLASSEMENT MANAGERS - Compact Top 10 */}
          {managerRanking && managerRanking.length > 0 && (
            <div style={{
              marginTop: "30px",
              borderTop: "2px solid #FFD500",
              paddingTop: "20px",
            }}>
              <p style={{ fontSize: "18px", fontWeight: "600", marginBottom: "10px", color: "#1a1a1a" }}>
                Classement Managers
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {managerRanking.map((m, idx) => (
                  <div key={m.manager_id} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: idx === 0 ? "#FEF3C7" : "#f9fafb",
                    borderRadius: "4px",
                    fontSize: "16px",
                  }}>
                    <span>
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`} {m.manager_nom}
                    </span>
                    <span style={{ fontWeight: "bold" }}>{m.total_points} pts</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FOOTER */}
          <div style={{ 
            position: "absolute",
            bottom: "40px",
            left: "40px",
            right: "40px",
            textAlign: "center",
            borderTop: "1px solid #e5e7eb",
            paddingTop: "25px"
          }}>
            <p style={{ fontSize: "28px", fontWeight: "600", color: "#1a1a1a", margin: 0 }}>
              {leagueName || "Mon Petit Cycliste"}
            </p>
          </div>
        </div>
      </div>
    </>
  );
};
