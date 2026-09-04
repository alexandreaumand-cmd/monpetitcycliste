import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Image as ImageIcon, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isStageRace as checkStageRace } from "@/lib/courseType";

interface RouteImage {
  etape_numero: number | null;
  image_url: string;
  label: string | null;
  sort_order: number;
  distance_km: number | null;
  axis_start_km: number | null;
  axis_end_km: number | null;
  axis_left_pct: number | null;
  axis_right_pct: number | null;
}



interface RouteImageUploaderProps {
  raceId: string;
  currentImageUrl: string | null;
  onUploadComplete: (url: string) => void;
  isStageRace?: boolean;
  totalStages?: number;
}

export function RouteImageUploader({ raceId, currentImageUrl, onUploadComplete, isStageRace: isStageRaceProp, totalStages: totalStagesProp }: RouteImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedStage, setSelectedStage] = useState<number | null>(null);
  const [existingImages, setExistingImages] = useState<RouteImage[]>([]);
  const [distanceInput, setDistanceInput] = useState("");
  const [handles, setHandles] = useState({ left: 0, right: 100 });
  const [testKm, setTestKm] = useState("");
  const [isSavingDistance, setIsSavingDistance] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<"left" | "right" | null>(null);

  const [autoDetected, setAutoDetected] = useState<{ isStageRace: boolean; totalStages: number } | null>(null);


  // Auto-detect stage race from course data if not provided as props
  useEffect(() => {
    if (isStageRaceProp !== undefined) return;
    
    const detect = async () => {
      const { data: course } = await supabase
        .from('courses')
        .select('type_course, date_debut, date_fin')
        .eq('id', raceId)
        .single();
      
      if (course) {
        const isStage = checkStageRace(course.type_course);
        let stages = 0;
        if (isStage && course.date_debut && course.date_fin) {
          const start = new Date(course.date_debut);
          const end = new Date(course.date_fin);
          stages = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        }
        setAutoDetected({ isStageRace: isStage, totalStages: stages });
      }
    };
    detect();
  }, [raceId, isStageRaceProp]);

  const isStageRace = isStageRaceProp ?? autoDetected?.isStageRace ?? false;
  const totalStages = totalStagesProp ?? autoDetected?.totalStages ?? 0;

  useEffect(() => {
    loadExistingImages();
  }, [raceId]);

  const loadExistingImages = async () => {
    const { data } = await supabase
      .from('course_route_images')
      .select('etape_numero, image_url, label, sort_order, distance_km, axis_left_pct, axis_right_pct')
      .eq('course_id', raceId)
      .order('sort_order', { ascending: true });
    setExistingImages((data as RouteImage[]) || []);
  };

  // Distance de l'étape + position du départ / de l'arrivée sur l'image (repère d'avancée du Live)
  const currentImage = existingImages.find((img) => img.etape_numero === selectedStage) ?? null;

  useEffect(() => {
    setDistanceInput(currentImage?.distance_km != null ? String(currentImage.distance_km) : "");
    setHandles({
      left: currentImage?.axis_left_pct != null ? Number(currentImage.axis_left_pct) : 0,
      right: currentImage?.axis_right_pct != null ? Number(currentImage.axis_right_pct) : 100,
    });
  }, [currentImage?.distance_km, currentImage?.axis_left_pct, currentImage?.axis_right_pct, selectedStage]);

  const num = (v: string) => {
    const raw = v.trim().replace(',', '.');
    if (raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : NaN;
  };

  const persist = useCallback(
    async (payload: { distance_km?: number | null; axis_left_pct?: number; axis_right_pct?: number }) => {
      setIsSavingDistance(true);
      let query = supabase
        .from('course_route_images')
        .update({ ...payload, axis_start_km: null, axis_end_km: null })
        .eq('course_id', raceId);
      query = selectedStage == null
        ? query.is('etape_numero', null)
        : query.eq('etape_numero', selectedStage);
      const { error } = await query;
      setIsSavingDistance(false);
      if (error) {
        toast.error("Enregistrement impossible", { description: error.message });
        return false;
      }
      loadExistingImages();
      return true;
    },
    [raceId, selectedStage]
  );

  const saveDistance = async () => {
    if (!currentImage) return;
    const value = num(distanceInput);
    if (value != null && (Number.isNaN(value) || value <= 0)) {
      toast.error("Distance invalide");
      return;
    }
    const ok = await persist({
      distance_km: value,
      axis_left_pct: handles.left,
      axis_right_pct: handles.right,
    });
    if (ok) toast.success("Réglages enregistrés");
  };

  const pctFromEvent = (clientX: number) => {
    const el = previewRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return null;
    return Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
  };

  const onHandleMove = (e: React.PointerEvent) => {
    const which = draggingRef.current;
    if (!which) return;
    const pct = pctFromEvent(e.clientX);
    if (pct == null) return;
    setHandles((h) =>
      which === "left"
        ? { ...h, left: Math.min(pct, h.right - 1) }
        : { ...h, right: Math.max(pct, h.left + 1) }
    );
  };

  const onHandleUp = async (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = null;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    await persist({ axis_left_pct: handles.left, axis_right_pct: handles.right });
  };

  const previewTotal = num(distanceInput);
  const previewRemaining = num(testKm);
  const previewPct =
    previewTotal != null && !Number.isNaN(previewTotal) && previewTotal > 0 &&
    previewRemaining != null && !Number.isNaN(previewRemaining) &&
    previewRemaining >= 0 && previewRemaining <= previewTotal
      ? handles.left + ((previewTotal - previewRemaining) / previewTotal) * (handles.right - handles.left)
      : null;

  const distanceField = currentImage && (
    <div className="space-y-2 w-full">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-muted-foreground whitespace-nowrap">
          Distance {selectedStage != null ? `Ét. ${selectedStage}` : ''} (km)
        </label>
        <Input
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          value={distanceInput}
          onChange={(e) => setDistanceInput(e.target.value)}
          placeholder="ex. 181,5"
          className="h-7 w-28 text-xs"
        />
        <Button variant="outline" size="sm" className="h-7" onClick={saveDistance} disabled={isSavingDistance}>
          <Check className="h-3.5 w-3.5 mr-1" />
          Enregistrer
        </Button>
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] text-muted-foreground whitespace-nowrap">km restants (test)</label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={testKm}
            onChange={(e) => setTestKm(e.target.value)}
            placeholder="ex. 40,2"
            className="h-7 w-24 text-xs"
          />
        </div>
      </div>

      <div
        ref={previewRef}
        className="relative inline-block max-w-full select-none"
        style={{ touchAction: "none" }}
        onPointerMove={onHandleMove}
        onPointerUp={onHandleUp}
        onPointerCancel={onHandleUp}
      >
        <img src={currentImage.image_url} alt="Aperçu du calage" className="max-w-full h-auto rounded-md border" draggable={false} />

        {(["left", "right"] as const).map((which) => (
          <div
            key={which}
            className="absolute inset-y-0 w-4 -translate-x-1/2 cursor-ew-resize flex justify-center"
            style={{ left: `${which === "left" ? handles.left : handles.right}%` }}
            onPointerDown={(e) => {
              draggingRef.current = which;
              (e.target as Element).setPointerCapture?.(e.pointerId);
            }}
          >
            <div className="w-px h-full bg-muted-foreground" />
            <div className="absolute -top-0.5 rounded-sm bg-muted-foreground px-1 text-[9px] font-semibold text-background">
              {which === "left" ? "0" : "fin"}
            </div>
          </div>
        ))}

        {previewPct != null && (
          <div className="absolute inset-y-0 w-[2px] bg-primary pointer-events-none" style={{ left: `${previewPct}%` }} />
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Glissez les deux poignées sur le départ (0 km) et l'arrivée du dessin. Saisissez des km restants de test pour vérifier le trait coloré.
      </p>
    </div>
  );



  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Format non supporté", { description: "Veuillez utiliser PNG, JPG ou WebP" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Fichier trop volumineux", { description: "La taille maximale est de 5 MB" });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('race_id', raceId);
      formData.append('file', file);
      
      if (isStageRace && selectedStage !== null) {
        formData.append('etape_numero', String(selectedStage));
        formData.append('label', `Étape ${selectedStage}`);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Vous devez être connecté");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/startlist-upload-route-image`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        }
      );

      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || 'Upload failed');

      if (json?.route_image_url) {
        onUploadComplete(json.route_image_url);
        toast.success("Image téléchargée", {
          description: isStageRace && selectedStage !== null 
            ? `Étape ${selectedStage} mise à jour` 
            : "L'image du parcours a été mise à jour"
        });
        if (isStageRace) {
          loadExistingImages();
        }
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error("Erreur lors du téléchargement", { description: error.message || "Une erreur s'est produite" });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const inputId = `route-image-upload-${raceId}`;

  // Simple mode for one-day races
  if (!isStageRace) {
    return (
      <div className="space-y-2">
        <input
          type="file"
          id={inputId}
          accept="image/png,image/jpeg,image/jpg,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => document.getElementById(inputId)?.click()}
          disabled={isUploading}
        >
          <Upload className="h-4 w-4 mr-2" />
          {isUploading ? 'Téléchargement...' : currentImageUrl ? 'Modifier le parcours' : 'Ajouter le parcours'}
        </Button>
        {distanceField}
      </div>
    );

  }

  // Multi-stage mode
  const stageOptions = [
    { value: null as number | null, label: 'Vue d\'ensemble' },
    ...Array.from({ length: totalStages }, (_, i) => ({ value: i + 1, label: `Ét. ${i + 1}` }))
  ];

  const getImageForStage = (stageNum: number | null) => 
    existingImages.find(img => img.etape_numero === stageNum);

  return (
    <div className="space-y-3">
      <input
        type="file"
        id={inputId}
        accept="image/png,image/jpeg,image/jpg,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Stage selector */}
      <div className="flex flex-wrap gap-1.5">
        {stageOptions.map((opt) => {
          const hasImage = !!getImageForStage(opt.value);
          return (
            <Button
              key={opt.value ?? 'overview'}
              variant={selectedStage === opt.value ? "default" : "outline"}
              size="sm"
              className={cn(
                "text-xs h-7 px-2",
                hasImage && selectedStage !== opt.value && "border-primary/50 text-primary"
              )}
              onClick={() => setSelectedStage(opt.value)}
            >
              {hasImage && <ImageIcon className="h-3 w-3 mr-1" />}
              {opt.label}
            </Button>
          );
        })}
      </div>

      {/* Upload button for selected stage */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => document.getElementById(inputId)?.click()}
          disabled={isUploading}
        >
          <Upload className="h-4 w-4 mr-2" />
          {isUploading ? 'Téléchargement...' : getImageForStage(selectedStage) ? 'Remplacer' : 'Ajouter'}
          {selectedStage !== null ? ` Ét. ${selectedStage}` : ' Vue d\'ensemble'}
        </Button>
        {distanceField}
      </div>



      {/* Thumbnails of existing images */}
      {existingImages.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {existingImages.map((img) => (
            <div 
              key={img.etape_numero ?? 'overview'} 
              className={cn(
                "relative w-16 h-16 rounded-md overflow-hidden border-2 cursor-pointer",
                selectedStage === img.etape_numero ? "border-primary" : "border-border"
              )}
              onClick={() => setSelectedStage(img.etape_numero)}
            >
              <img src={img.image_url} alt={img.label || ''} className="w-full h-full object-cover" />
              <div className="absolute bottom-0 left-0 right-0 bg-background/80 text-foreground text-[9px] text-center py-0.5">
                {img.etape_numero ? `É${img.etape_numero}` : 'VE'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}