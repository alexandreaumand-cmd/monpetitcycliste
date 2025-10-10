import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Trophy, Star, Timer, Users, Target } from "lucide-react";

interface BonusPoint {
  id: string;
  bonus_type: string;
  points: number;
  commentaire?: string;
  coureur?: { nom: string; equipe: string };
  manager?: { nom: string };
  target_manager?: { nom: string };
}

interface BonusListTableProps {
  bonuses: BonusPoint[];
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

const BONUS_ICONS: Record<string, any> = {
  first_win: Trophy,
  coureur_bonuse: Star,
  itt: Timer,
  ttt: Users,
  scoreurs: Target,
};

const BONUS_LABELS: Record<string, string> = {
  first_win: 'First Win',
  coureur_bonuse: 'Coureur Bonusé',
  itt: 'ITT',
  ttt: 'TTT',
  scoreurs: 'Scoreurs',
};

const RIDER_BONUS_TYPES = ['first_win', 'coureur_bonuse', 'itt'];
const MANAGER_BONUS_TYPES = ['ttt', 'scoreurs'];

const BonusTable = ({ bonuses, onDelete, isDeleting, title }: { 
  bonuses: BonusPoint[]; 
  onDelete: (id: string) => void; 
  isDeleting: boolean;
  title: string;
}) => {
  const isManagerBonus = MANAGER_BONUS_TYPES.includes(bonuses[0]?.bonus_type);

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">{title}</h4>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>{isManagerBonus ? 'Manager' : 'Coureur (Manager)'}</TableHead>
              <TableHead className="text-right">Points</TableHead>
              <TableHead>Commentaire</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bonuses.map((bonus) => {
              const Icon = BONUS_ICONS[bonus.bonus_type];
              const targetName = bonus.coureur
                ? `${bonus.coureur.nom} (${bonus.manager?.nom || 'N/A'})`
                : bonus.target_manager?.nom || 'N/A';

              return (
                <TableRow key={bonus.id}>
                  <TableCell>
                    <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                      {Icon && <Icon className="h-3 w-3" />}
                      {BONUS_LABELS[bonus.bonus_type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{targetName}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={bonus.points > 0 ? "default" : "secondary"}>
                      {bonus.points > 0 ? '+' : ''}{bonus.points}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {bonus.commentaire || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(bonus.id)}
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export const BonusListTable = ({ bonuses, onDelete, isDeleting }: BonusListTableProps) => {
  if (bonuses.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Aucun bonus attribué pour cette phase
      </div>
    );
  }

  const riderBonuses = bonuses.filter(b => RIDER_BONUS_TYPES.includes(b.bonus_type));
  const managerBonuses = bonuses.filter(b => MANAGER_BONUS_TYPES.includes(b.bonus_type));

  return (
    <div className="space-y-6">
      {riderBonuses.length > 0 && (
        <BonusTable 
          bonuses={riderBonuses}
          onDelete={onDelete}
          isDeleting={isDeleting}
          title="📝 Bonus Coureur"
        />
      )}
      
      {managerBonuses.length > 0 && (
        <BonusTable 
          bonuses={managerBonuses}
          onDelete={onDelete}
          isDeleting={isDeleting}
          title="👤 Bonus Manager"
        />
      )}
    </div>
  );
};
