import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Download, Loader2, Upload, CheckCircle2 } from "lucide-react";

type PreviewRow = {
  coureur_id: string;
  nom: string;
  oldPrice: number | null;
  newPrice: number | null;
  status: "modifie" | "inchange" | "inconnu" | "invalide";
};

export const SeasonPricesImport = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saisonId, setSaisonId] = useState<string>("");
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [applying, setApplying] = useState(false);

  const { data: saisons } = useQuery({
    queryKey: ["saisons", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saisons")
        .select("id, annee")
        .order("annee", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: rows, isLoading } = useQuery({
    queryKey: ["coureurs-saisons", "prices", saisonId],
    enabled: !!saisonId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coureurs_saisons")
        .select("coureur_id, prix_initial, equipe_id, coureurs(nom)")
        .eq("saison_id", saisonId);
      if (error) throw error;

      const { data: teams, error: tErr } = await supabase
        .from("equipes_saisons")
        .select("equipe_id, nom_affiche")
        .eq("saison_id", saisonId);
      if (tErr) throw tErr;
      const teamMap = new Map((teams ?? []).map((t: any) => [t.equipe_id, t.nom_affiche]));

      return (data ?? []).map((r: any) => ({
        coureur_id: r.coureur_id as string,
        nom: (r.coureurs?.nom as string) ?? r.coureur_id,
        equipe: r.equipe_id ? teamMap.get(r.equipe_id) ?? "" : "",
        prix_initial: Number(r.prix_initial ?? 0),
      }));
    },
  });

  // Block the import while an auction is open on this season
  const { data: openAuctions } = useQuery({
    queryKey: ["season-open-auctions", saisonId],
    enabled: !!saisonId,
    queryFn: async () => {
      const { data: phases, error } = await supabase
        .from("phases")
        .select("id")
        .eq("saison_id", saisonId);
      if (error) throw error;
      const ids = (phases ?? []).map((p: any) => p.id);
      if (ids.length === 0) return 0;
      const { count, error: aErr } = await supabase
        .from("auctions")
        .select("id", { count: "exact", head: true })
        .in("phase_id", ids)
        .eq("statut", "open");
      if (aErr) throw aErr;
      return count ?? 0;
    },
  });

  const locked = (openAuctions ?? 0) > 0;

  const byId = useMemo(
    () => new Map((rows ?? []).map((r) => [r.coureur_id, r])),
    [rows],
  );

  const downloadTemplate = () => {
    if (!rows || rows.length === 0) {
      toast({
        title: "Aucun coureur",
        description: "Cette saison ne contient aucun coureur à exporter.",
        variant: "destructive",
      });
      return;
    }
    const annee = (saisons ?? []).find((s: any) => s.id === saisonId)?.annee ?? "";
    const ws = XLSX.utils.json_to_sheet(
      rows.map((r) => ({
        coureur_id: r.coureur_id,
        nom: r.nom,
        equipe: r.equipe,
        prix_initial: r.prix_initial,
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "cotes");
    XLSX.writeFile(wb, `cotes_${annee}.xlsx`);
  };

  const handleFile = async (file: File) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    const next: PreviewRow[] = parsed.map((raw) => {
      const id = String(raw.coureur_id ?? "").trim();
      const existing = byId.get(id);
      const rawPrice = String(raw.prix_initial ?? "").replace(",", ".").trim();
      const newPrice = rawPrice === "" ? null : Number(rawPrice);

      if (!id || !existing) {
        return {
          coureur_id: id,
          nom: String(raw.nom ?? "") || id || "—",
          oldPrice: null,
          newPrice,
          status: "inconnu",
        };
      }
      if (newPrice === null || !Number.isFinite(newPrice) || newPrice < 0) {
        return {
          coureur_id: id,
          nom: existing.nom,
          oldPrice: existing.prix_initial,
          newPrice: null,
          status: "invalide",
        };
      }
      return {
        coureur_id: id,
        nom: existing.nom,
        oldPrice: existing.prix_initial,
        newPrice,
        status: newPrice === existing.prix_initial ? "inchange" : "modifie",
      };
    });

    setPreview(next);
  };

  const toApply = (preview ?? []).filter((p) => p.status === "modifie");

  const apply = async () => {
    if (toApply.length === 0) return;
    setApplying(true);
    try {
      for (const row of toApply) {
        const { error } = await supabase
          .from("coureurs_saisons")
          .update({ prix_initial: row.newPrice as number })
          .eq("saison_id", saisonId)
          .eq("coureur_id", row.coureur_id);
        if (error) throw error;
      }
      toast({
        title: "Côtes mises à jour",
        description: `${toApply.length} coureur(s) modifié(s).`,
      });
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["coureurs-saisons"] });
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Échec de la mise à jour",
        variant: "destructive",
      });
    } finally {
      setApplying(false);
    }
  };

  const counts = useMemo(() => {
    const p = preview ?? [];
    return {
      modifie: p.filter((r) => r.status === "modifie").length,
      inchange: p.filter((r) => r.status === "inchange").length,
      inconnu: p.filter((r) => r.status === "inconnu").length,
      invalide: p.filter((r) => r.status === "invalide").length,
    };
  }, [preview]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          <CardTitle>Mettre à jour les côtes (Excel)</CardTitle>
        </div>
        <CardDescription>
          Exportez le modèle, ajustez la colonne <code>prix_initial</code> dans Excel, puis
          ré-importez le fichier. Seules les lignes modifiées sont appliquées.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Saison</Label>
            <Select
              value={saisonId}
              onValueChange={(v) => {
                setSaisonId(v);
                setPreview(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir une saison" />
              </SelectTrigger>
              <SelectContent>
                {(saisons ?? []).map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.annee}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={downloadTemplate} disabled={!saisonId || isLoading}>
              <Download className="mr-2 h-4 w-4" />
              Exporter le modèle
            </Button>
          </div>
        </div>

        {saisonId && (
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Chargement…" : `${rows?.length ?? 0} coureur(s) sur cette saison.`}
          </p>
        )}

        {locked && (
          <p className="text-sm text-destructive">
            Une enchère est actuellement ouverte sur cette saison : la mise à jour des côtes est
            bloquée.
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="prices-file">Fichier à importer (.xlsx ou .csv)</Label>
          <input
            id="prices-file"
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            disabled={!saisonId || locked}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-sm file:font-medium"
          />
        </div>

        {preview && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge>{counts.modifie} modifiée(s)</Badge>
              <Badge variant="secondary">{counts.inchange} inchangée(s)</Badge>
              {counts.inconnu > 0 && (
                <Badge variant="destructive">{counts.inconnu} coureur(s) inconnu(s)</Badge>
              )}
              {counts.invalide > 0 && (
                <Badge variant="destructive">{counts.invalide} valeur(s) invalide(s)</Badge>
              )}
            </div>

            <div className="max-h-96 overflow-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Coureur</TableHead>
                    <TableHead className="text-right">Ancienne côte</TableHead>
                    <TableHead className="text-right">Nouvelle côte</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview
                    .filter((r) => r.status !== "inchange")
                    .map((r, i) => (
                      <TableRow key={`${r.coureur_id}-${i}`}>
                        <TableCell className="font-medium">{r.nom}</TableCell>
                        <TableCell className="text-right">{r.oldPrice ?? "—"}</TableCell>
                        <TableCell className="text-right">{r.newPrice ?? "—"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              r.status === "modifie"
                                ? "default"
                                : r.status === "inchange"
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {r.status === "modifie"
                              ? "Modifiée"
                              : r.status === "inconnu"
                                ? "Coureur inconnu"
                                : "Valeur invalide"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>

            <Button onClick={apply} disabled={applying || locked || toApply.length === 0}>
              {applying ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Appliquer {toApply.length} modification(s)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
