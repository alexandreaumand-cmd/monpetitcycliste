import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { useLeague } from "@/contexts/LeagueContext";
import { useLeagueStandingsBySeason, useLeagueStandingsByPhase } from "@/hooks/useLeagueStandings";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

  // Fetch today's points per manager
  const { data: todayPointsMap } = useQuery({
    queryKey: ["today-points", leagueId],
    queryFn: async () => {
      if (!leagueId) return {};
      const today = new Date().toISOString().split("T")[0];

      // 1. Get today's race results (coureur_id + course_id combos)
      const { data: todayResults } = await supabase
        .from("race_results")
        .select("coureur_id, course_id, type_classement, etape_numero")
        .eq("date_classement", today);

      if (!todayResults?.length) return {};

      // 2. Get points for those results
      const courseIds = [...new Set(todayResults.map((r) => r.course_id))];
      const coureurIds = [...new Set(todayResults.map((r) => r.coureur_id))];

      const { data: pointsData } = await supabase
        .from("points_ledger")
        .select("coureur_id, points, phase_id")
        .in("course_id", courseIds)
        .in("coureur_id", coureurIds);

      if (!pointsData?.length) return {};

      // 3. Get rosters for this league to map coureur → manager
      const phaseIds = [...new Set(pointsData.map((p) => p.phase_id).filter(Boolean))];
      const { data: rosterData } = await supabase
        .from("rosters")
        .select("coureur_id, manager_id, phase_id")
        .eq("league_id", leagueId)
        .in("phase_id", phaseIds as string[])
        .in("coureur_id", coureurIds);

      if (!rosterData?.length) return {};

      // Build lookup: coureur+phase → manager
      const rosterMap = new Map<string, string>();
      for (const r of rosterData) {
        rosterMap.set(`${r.coureur_id}_${r.phase_id}`, r.manager_id);
      }

      // Sum points per manager
      const result: Record<string, number> = {};
      for (const p of pointsData) {
        const mgr = rosterMap.get(`${p.coureur_id}_${p.phase_id}`);
        if (mgr) {
          result[mgr] = (result[mgr] || 0) + p.points;
        }
      }
      return result;
    },
    enabled: !!leagueId,
    staleTime: 5 * 60 * 1000,
  });

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

      <MountainRoadSVG
        standings={standings}
        range={range}
        leaderPts={leaderPts}
        todayPointsMap={todayPointsMap || {}}
      />
    </div>
  );
}

/* ── Road position helper ─────────────────────────────── */

interface RoadGeometry {
  roadPoints: { x: number; y: number }[];
  totalLength: number;
}

function getPositionOnRoad(
  t: number,
  { roadPoints, totalLength }: RoadGeometry
): { x: number; y: number } {
  const clampedT = Math.max(0, Math.min(1, t));
  const targetDist = clampedT * totalLength;
  let walked = 0;
  let pos = roadPoints[0];

  for (let i = 1; i < roadPoints.length; i++) {
    const prev = roadPoints[i - 1];
    const curr = roadPoints[i];
    const segLen = Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2);
    if (walked + segLen >= targetDist) {
      const frac = segLen > 0 ? (targetDist - walked) / segLen : 0;
      return {
        x: prev.x + (curr.x - prev.x) * frac,
        y: prev.y + (curr.y - prev.y) * frac,
      };
    }
    walked += segLen;
    pos = curr;
  }
  return pos;
}

/* ── SVG mountain road with animation ─────────────────── */

const ROAD_COLOR = "hsl(var(--muted))";
const ROAD_STROKE = "hsl(var(--border))";

function MountainRoadSVG({
  standings,
  range,
  leaderPts,
  todayPointsMap,
}: {
  standings: ManagerStanding[];
  range: number;
  leaderPts: number;
  todayPointsMap: Record<string, number>;
}) {
  const count = standings.length;
  const svgH = Math.max(500, count * 60 + 100);
  const svgW = 360;
  const marginTop = 60;
  const marginBot = 40;
  const roadH = svgH - marginTop - marginBot;

  const turns = 7;
  const segH = roadH / turns;
  const leftX = 60;
  const rightX = svgW - 60;

  // Build road geometry
  const roadGeometry = useMemo(() => {
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
    return { roadPoints, totalLength };
  }, [svgH, segH]);

  const pathD = roadGeometry.roadPoints
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(" ");

  // Compute start/end positions and road-following keyframes for each manager
  const managers = useMemo(() => {
    const withoutToday = standings.map((s) => ({
      ...s,
      points_before: s.total_points - (todayPointsMap[s.manager_id] || 0),
      today_points: todayPointsMap[s.manager_id] || 0,
    }));

    const sortedBefore = [...withoutToday].sort((a, b) => b.points_before - a.points_before);
    const leaderBefore = sortedBefore[0]?.points_before || 0;
    const lastBefore = sortedBefore[sortedBefore.length - 1]?.points_before || 0;
    const rangeBefore = leaderBefore - lastBefore || 1;

    return standings.map((s, idx) => {
      const todayPts = todayPointsMap[s.manager_id] || 0;
      const pointsBefore = s.total_points - todayPts;

      // End t (current)
      const gapEnd = leaderPts - s.total_points;
      const tEnd = range > 0 ? gapEnd / range : idx / Math.max(count - 1, 1);
      const endPos = getPositionOnRoad(tEnd, roadGeometry);

      // Start t (before today)
      const gapStart = leaderBefore - pointsBefore;
      const tStart = rangeBefore > 0 ? gapStart / rangeBefore : idx / Math.max(count - 1, 1);

      // Sample keyframes along the road from tStart to tEnd (going UP = decreasing t)
      const STEPS = 30;
      const keyframesX: number[] = [];
      const keyframesY: number[] = [];

      for (let step = 0; step <= STEPS; step++) {
        const progress = step / STEPS;
        const tCurrent = tStart + (tEnd - tStart) * progress;
        const pos = getPositionOnRoad(tCurrent, roadGeometry);
        // Store as offsets from final position
        keyframesX.push(pos.x - endPos.x);
        keyframesY.push(pos.y - endPos.y);
      }

      return {
        ...s,
        rank: idx + 1,
        cx: endPos.x,
        cy: endPos.y,
        todayPts,
        keyframesX,
        keyframesY,
      };
    });
  }, [standings, todayPointsMap, leaderPts, range, count, roadGeometry]);

  const podiumColors: Record<number, string> = {
    1: "#FFD700",
    2: "#C0C0C0",
    3: "#CD7F32",
  };

  // Check if any manager has today points (triggers movement animation)
  const hasTodayPoints = Object.values(todayPointsMap).some((p) => p > 0);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-b from-sky-100 via-green-50 to-green-200 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 border">
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

        {/* Managers with animation */}
        {[...managers].reverse().map((m, reverseIdx) => {
          const isLeft = m.cx < svgW / 2;
          const labelX = isLeft ? m.cx + 22 : m.cx - 22;
          const anchor = isLeft ? "start" : "end";
          const color = podiumColors[m.rank] || "hsl(var(--foreground))";
          const delay = reverseIdx * 0.08;

          // If today points exist, animate from start position to end
          // Otherwise just fade in with a staggered entrance
          const hasMovement = hasTodayPoints && m.todayPts > 0;
          const dx = m.cx - m.startCx;
          const dy = m.cy - m.startCy;

          return (
            <motion.g
              key={m.manager_id}
              initial={{
                opacity: 0,
                x: hasMovement ? -dx : 0,
                y: hasMovement ? -dy : 15,
              }}
              animate={{
                opacity: 1,
                x: 0,
                y: 0,
              }}
              transition={{
                duration: hasMovement ? 10 : 0.6,
                delay: hasMovement ? 0.3 + delay : delay,
                ease: hasMovement ? [0.25, 0.1, 0.25, 1] : "easeOut",
              }}
            >
              {/* Podium glow */}
              {m.rank <= 3 && (
                <circle cx={m.cx} cy={m.cy} r={16} fill={color} opacity={0.25} />
              )}

              {/* Today points burst indicator */}
              {m.todayPts > 0 && (
                <motion.circle
                  cx={m.cx}
                  cy={m.cy}
                  r={12}
                  fill="hsl(var(--primary))"
                  initial={{ opacity: 0.6, r: 8 }}
                  animate={{ opacity: 0, r: 28 }}
                  transition={{
                    duration: 1.5,
                    delay: hasMovement ? 10.5 + delay : 0.6 + delay,
                    ease: "easeOut",
                  }}
                />
              )}

              {/* Bike emoji */}
              <text
                x={m.cx}
                y={m.cy + 5}
                textAnchor="middle"
                fontSize={18}
                style={{
                  transform: `scaleX(-1)`,
                  transformOrigin: `${m.cx}px ${m.cy + 5}px`,
                }}
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

              {/* Name + points */}
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
                {m.todayPts > 0 && ` (+${Math.round(m.todayPts)})`}
              </text>
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
}
