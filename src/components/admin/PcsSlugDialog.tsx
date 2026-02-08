import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink, Loader2 } from "lucide-react";

interface PcsSlugDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slugUsed: string;
  errorMessage: string;
  onRetry: (newSlug: string) => void;
  isRetrying: boolean;
}

export const PcsSlugDialog = ({
  open,
  onOpenChange,
  slugUsed,
  errorMessage,
  onRetry,
  isRetrying,
}: PcsSlugDialogProps) => {
  const [slug, setSlug] = useState(slugUsed);

  // Reset slug when dialog opens with new value
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) setSlug(slugUsed);
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Slug PCS introuvable</DialogTitle>
          <DialogDescription>
            Le slug auto-détecté ne correspond pas à la page PCS. Corrigez-le ci-dessous.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-destructive">{errorMessage}</p>

          <div className="space-y-2">
            <Label htmlFor="pcs-slug">Slug PCS</Label>
            <Input
              id="pcs-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="ex: vuelta-a-la-comunidad-valenciana"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Copiez le slug depuis l'URL PCS : procyclingstats.com/race/<strong>{slug || '...'}</strong>/2026/...
            </p>
          </div>

          <a
            href={`https://www.procyclingstats.com/race/${slug || slugUsed}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Vérifier sur PCS
          </a>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isRetrying}>
            Annuler
          </Button>
          <Button onClick={() => onRetry(slug.trim())} disabled={isRetrying || !slug.trim()}>
            {isRetrying ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Réessai...</>
            ) : (
              "Réessayer"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
