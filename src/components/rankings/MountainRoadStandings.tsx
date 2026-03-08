import { useMemo } from "react";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { useLeague } from "@/contexts/LeagueContext";
import { useLeagueStandingsBySeason, useLeagueStandingsByPhase } from "@/hooks/useLeagueStandings";
import { useGlobalStandings } from "@/hooks/useGlobalStandings";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Mountain } from "lucide-react";

interface ManagerStanding {
  manager_id: string;
  manager_nom: string;
  total_points: number;
}

export function MountainRoadStandings() {
  const { selectedSeason, phases } = useSeasonContext();
  const { leagueId } = useLeague();
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);

  const { data: seasonData, isLoading: seasonLoading } = useLeagueStandingsBySeason(
    !selectedPhase ? leagueId : null,
    !selectedPhase ? selectedSeason?.id ?? null : null
  );
  const { data: phaseData, isLoading: phaseLoading } = useLeagueStandingsByPhase(
    selectedPhase ? leagueId : null,
    selectedPhase
  );

  const isLoading = selectedPhase ? phaseLoading : seasonLoading;
  const rawStandings: ManagerStanding[] = (selectedPhase ? phaseData : seasonData) as ManagerStanding[] ?? [];

  const standings = useMemo(
    () => [...rawStandings].sort((a, b) => b.total_points - a.total_points),
    [rawStandings]
  );

  if (isLoading) {
    return <Skeleton className="h-[500px] w-full rounded-2xl" />;
  }

  if (!standings.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
        <Mountain className="h-10 w-10" />
        <p>Aucun classement disponible</p>
      </div>
    );
  }

  const leaderPts = standings[0].total_points;
  const lastPts = standings[standings.length - 1].total_points;
  const range = leaderPts - lastPts || 1;

  return (
    <div className="space-y-3">
      {/* Phase selector */}
      <Select
        value={selectedPhase || "total"}
        onValueChange={(v) => setSelectedPhase(v === "total" ? null : v)}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="total">🏔️ Classement Total</SelectItem>
          {phases?.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              Phase {p.index_dans_saison}
              {p.statut === "active" ? " (en cours)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Mountain road SVG */}
      <MountainRoadSVG standings={standings} range={range} leaderPts={leaderPts} />
    </div>
  );
}

/* ── SVG mountain road ─────────────────────────────── */

const ROAD_COLOR = "hsl(var(--muted))";
const ROAD_STROKE = "hsl(var(--border))";

function MountainRoadSVG({
  standings,
  range,
  leaderPts,
}: {
  standings: ManagerStanding[];
  range: number;
  leaderPts: number;
}) {
  const count = standings.length;
  // Responsive height based on count
  const svgH = Math.max(500, count * 60 + 100);
  const svgW = 360;
  const marginTop = 60;
  const marginBot = 40;
  const roadH = svgH - marginTop - marginBot;

  // Build switchback road path with 6 hairpin turns
  const turns = 7;
  const segH = roadH / turns;
  const leftX = 60;
  const rightX = svgW - 60;

  // Build points along the road path for position calculation
  const roadPoints: { x: number; y: number }[] = [];
  let totalLength = 0;

  for (let i = 0; i <= turns; i++) {
    const y = marginTop + i * segH;
    const isLeft = i % 2 === 0;
    const x = isLeft ? leftX : rightX;
    if (i > 0) {
      const prev = roadPoints[roadPoints.length - 1];
      totalLength += Math.sqrt((x - prev.x) ** 2 + (y - prev.y) ** 2);
    }
    roadPoints.push({ x, y });
  }

  // SVG path for the road
  const pathD = roadPoints
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(" ");

  // Position each manager along the road based on point gap
  const managers = standings.map((s, idx) => {
    const gap = leaderPts - s.total_points;
    // t = 0 → leader (top), t = 1 → last (bottom)
    const t = range > 0 ? gap / range : idx / Math.max(count - 1, 1);
    const clampedT = Math.max(0, Math.min(1, t));

    // Walk along road segments to find position at t
    const targetDist = clampedT * totalLength;
    let walked = 0;
    let pos = roadPoints[0];

    for (let i = 1; i < roadPoints.length; i++) {
      const prev = roadPoints[i - 1];
      const curr = roadPoints[i];
      const segLen = Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2);
      if (walked + segLen >= targetDist) {
        const frac = segLen > 0 ? (targetDist - walked) / segLen : 0;
        pos = {
          x: prev.x + (curr.x - prev.x) * frac,
          y: prev.y + (curr.y - prev.y) * frac,
        };
        break;
      }
      walked += segLen;
      pos = curr;
    }

    return { ...s, rank: idx + 1, cx: pos.x, cy: pos.y };
  });

  const podiumColors: Record<number, string> = {
    1: "#FFD700",
    2: "#C0C0C0",
    3: "#CD7F32",
  };

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-b from-sky-100 via-green-50 to-green-200 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 border">
      {/* Summit decoration */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 text-center z-10">
        <span className="text-2xl">🏔️</span>
        <p className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Sommet</p>
      </div>


      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="w-full"
        style={{ height: `${svgH}px`, maxHeight: "80vh" }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Road shadow */}
        <path
          d={pathD}
          fill="none"
          stroke="hsl(0 0% 0% / 0.1)"
          strokeWidth={30}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Road surface */}
        <path
          d={pathD}
          fill="none"
          stroke={ROAD_COLOR}
          strokeWidth={26}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Road center dashes */}
        <path
          d={pathD}
          fill="none"
          stroke={ROAD_STROKE}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="8 12"
        />

        {/* Managers (bottom to top so leader renders last / on top) */}
        {[...managers].reverse().map((m) => {
          const isLeft = m.cx < svgW / 2;
          const labelX = isLeft ? m.cx + 22 : m.cx - 22;
          const anchor = isLeft ? "start" : "end";
          const color = podiumColors[m.rank] || "hsl(var(--foreground))";

          return (
            <g key={m.manager_id}>
              {/* Podium glow */}
              {m.rank <= 3 && (
                <circle cx={m.cx} cy={m.cy} r={16} fill={color} opacity={0.25} />
              )}
              {/* Bike emoji as text */}
              <text
                x={m.cx}
                y={m.cy + 5}
                textAnchor="middle"
                fontSize={18}
                style={{ transform: `scaleX(-1)`, transformOrigin: `${m.cx}px ${m.cy + 5}px` }}
              >
                🚴
              </text>
              {/* Rank circle */}
              <circle
                cx={m.cx}
                cy={m.cy - 14}
                r={9}
                fill={podiumColors[m.rank] || "hsl(var(--muted))"}
                stroke="hsl(var(--border))"
                strokeWidth={1}
              />
              <text
                x={m.cx}
                y={m.cy - 10}
                textAnchor="middle"
                fontSize={8}
                fontWeight="bold"
                fill={m.rank <= 3 ? "#000" : "hsl(var(--muted-foreground))"}
              >
                {m.rank}
              </text>
              {/* Name + points label */}
              <text
                x={labelX}
                y={m.cy - 6}
                textAnchor={anchor}
                fontSize={13}
                fontWeight="700"
                fill="hsl(var(--foreground))"
                className="drop-shadow"
              >
                {m.manager_nom}
              </text>
              <text
                x={labelX}
                y={m.cy + 8}
                textAnchor={anchor}
                fontSize={11}
                fontWeight="500"
                fill="hsl(var(--muted-foreground))"
              >
                {Math.round(m.total_points)} pts
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
