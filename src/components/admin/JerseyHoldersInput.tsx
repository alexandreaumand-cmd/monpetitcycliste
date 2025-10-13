import { CoureursCombobox } from "@/components/shared/CoureursCombobox";

type JerseyType = 'general' | 'vert' | 'montagne' | 'jeune' | 'combattif';

type JerseyHolders = {
  general: string | null;
  vert: string | null;
  montagne: string | null;
  jeune: string | null;
  combattif: string | null;
};

type JerseyHoldersInputProps = {
  phaseId: string;
  jerseyHolders: JerseyHolders;
  onChange: (type: JerseyType, coureurId: string | null) => void;
};

const JERSEY_CONFIG = [
  { type: 'general' as JerseyType, icon: '🟡', label: 'Jaune' },
  { type: 'vert' as JerseyType, icon: '🟢', label: 'Vert' },
  { type: 'montagne' as JerseyType, icon: '🔴', label: 'Pois' },
  { type: 'jeune' as JerseyType, icon: '⚪', label: 'Blanc' },
  { type: 'combattif' as JerseyType, icon: '🔵', label: 'Combativité' },
];

export const JerseyHoldersInput = ({ phaseId, jerseyHolders, onChange }: JerseyHoldersInputProps) => {
  return (
    <div className="border rounded-lg p-4 bg-muted/30">
      <h4 className="text-sm font-medium mb-3">Porteurs de maillots après l'étape (optionnel)</h4>
      <div className="grid grid-cols-3 gap-3">
        {JERSEY_CONFIG.map(({ type, icon, label }) => (
          <div key={type} className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <span className="text-lg">{icon}</span>
              {label}
            </label>
            <CoureursCombobox
              phaseId={phaseId}
              value={jerseyHolders[type]}
              onSelect={(coureur) => {
                onChange(type, coureur ? coureur.coureur_id : null);
              }}
              showTakenRiders={true}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
