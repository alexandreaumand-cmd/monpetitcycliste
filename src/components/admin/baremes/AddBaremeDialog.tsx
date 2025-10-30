import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";

interface AddBaremeDialogProps {
  saisons: any[];
  onAdd: (bareme: {
    saison_id: string;
    categorie: string;
    type_classement: string;
    place: number;
    points: number;
  }) => void;
}

const categories = [
  "WT Monument",
  "WT GT",
  "Classiques WT Cat 1",
  "Classiques WT Cat 2",
  "Classiques WT Cat 3",
  "Tours WT Cat 1",
  "Tours WT Cat 2",
  "Tours WT Cat 3",
  "1.1",
  "1.pro",
  "2.1",
  "2.pro",
  "CN_ITT Cat 1",
  "CN_ITT Cat 2",
  "CN_ITT Cat 3",
  "CN_ITT Cat 4",
  "CN_RR Cat 1",
  "CN_RR Cat 2",
  "CN_RR Cat 3",
  "CN_RR Cat 4",
  "EC ITT",
  "EC RR",
  "WC ITT",
  "WC RR",
];

const typeClassements = [
  { value: "General", label: "Général" },
  { value: "Etape", label: "Étape" },
  { value: "Points", label: "Points" },
  { value: "Montagne", label: "Montagne" },
  { value: "Jeune", label: "Jeune" },
  { value: "Combatif", label: "Combativité" },
  { value: "Porteur Général", label: "🟡 Porteur Jaune" },
  { value: "Porteur Vert", label: "🟢 Porteur Vert" },
  { value: "Porteur Montagne", label: "🔴 Porteur Pois" },
  { value: "Porteur Jeune", label: "⚪ Porteur Blanc" },
  { value: "Porteur Combattif", label: "🔵 Porteur Combativité" },
];

export function AddBaremeDialog({ saisons, onAdd }: AddBaremeDialogProps) {
  const [open, setOpen] = useState(false);
  const [newBareme, setNewBareme] = useState({
    saison_id: "",
    categorie: "",
    type_classement: "",
    place: 1,
    points: 0,
  });

  const handleSubmit = () => {
    if (!newBareme.saison_id || !newBareme.categorie || !newBareme.type_classement) {
      return;
    }

    onAdd(newBareme);
    setNewBareme({
      saison_id: "",
      categorie: "",
      type_classement: "",
      place: 1,
      points: 0,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau barème
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un barème</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Saison</Label>
            <Select
              value={newBareme.saison_id}
              onValueChange={(value) => setNewBareme({ ...newBareme, saison_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une saison" />
              </SelectTrigger>
              <SelectContent>
                {saisons?.map((saison) => (
                  <SelectItem key={saison.id} value={saison.id}>
                    {saison.annee}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Catégorie</Label>
            <Select
              value={newBareme.categorie}
              onValueChange={(value) => setNewBareme({ ...newBareme, categorie: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une catégorie" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Type de classement</Label>
            <Select
              value={newBareme.type_classement}
              onValueChange={(value) => setNewBareme({ ...newBareme, type_classement: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un type" />
              </SelectTrigger>
              <SelectContent>
                {typeClassements.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Place</Label>
            <Input
              type="number"
              min="1"
              value={newBareme.place}
              onChange={(e) => setNewBareme({ ...newBareme, place: parseInt(e.target.value) || 1 })}
            />
          </div>

          <div className="space-y-2">
            <Label>Points</Label>
            <Input
              type="number"
              min="0"
              value={newBareme.points}
              onChange={(e) => setNewBareme({ ...newBareme, points: parseInt(e.target.value) || 0 })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!newBareme.saison_id || !newBareme.categorie || !newBareme.type_classement}
            >
              Ajouter
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
