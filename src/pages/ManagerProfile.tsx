import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useLeague } from "@/contexts/LeagueContext";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { useManagerSponsor } from "@/hooks/useManagerSponsor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Trophy,
  Target,
  Users,
  Coins,
  TrendingUp,
  Medal,
  Flag,
  Percent,
  Star,
  Repeat,
} from "lucide-react";

const fmt = (n: number | null | undefined) =>
  n == null ? "-" : Math.round(Number(n)).toLocaleString("fr-FR");

export default function ManagerProfile() {
  const { managerId } = useParams<{ managerId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation("rankings");
  const { leagueId } = useLeague();
  const { selectedSeason, phases } = useSeasonContext();
  const [rosterPhaseId, setRosterPhaseId] = useState<string>("all");

  const seasonPhases = useMemo(
    () =>
      (phases ?? [])
        .filter((p) => !selectedSeason || p.saison_id === selectedSeason.id)
        .sort((a, b) => a.index_dans_saison - b.index_dans_saison),
    [phases, selectedSeason]
  );

  const { data: info, isLoading: infoLoading } = useQuery({
    queryKey: ["manager-public-info", managerId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_manager_public_info", {
        manager_id: managerId!,
      });
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!managerId,
  });

  const { data: sponsor } = useManagerSponsor(managerId, selectedSeason?.id);

  const { data: seasonStandings } = useQuery({
    queryKey: ["mp-season-standings", leagueId, selectedSeason?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_manager_standings_by_season", {
        _league_id: leagueId!,
        _saison_id: selectedSeason?.id,
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!leagueId,
  });

  const { data: phaseStandings } = useQuery({
    queryKey: ["mp-phase-standings", leagueId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_manager_standings_by_phase", {
        _league_id: leagueId!,
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!leagueId,
  });

  const { data: roster, isLoading: rosterLoading } = useQuery({
    queryKey: ["mp-roster", managerId, leagueId, rosterPhaseId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("manager_team_by_id", {
        p_manager_id: managerId!,
        p_league_id: leagueId ?? undefined,
        p_phase_id: rosterPhaseId === "all" ? undefined : rosterPhaseId,
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!managerId,
  });

  const { data: pronostics } = useQuery({
    queryKey: ["mp-pronostics", leagueId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_arena_pronostic_standings", {
        p_league_id: leagueId!,
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!leagueId,
  });

  const { data: extra, isLoading: extraLoading } = useQuery({
    queryKey: ["mp-extra-stats", managerId, leagueId, selectedSeason?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_manager_extra_stats", {
        _manager_id: managerId!,
        _league_id: leagueId ?? undefined,
        _saison_id: selectedSeason?.id ?? undefined,
      });
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!managerId,
  });


  const sorted = useMemo(
    () =>
      [...(seasonStandings ?? [])].sort(
        (a, b) => Number(b.total_points) - Number(a.total_points)
      ),
    [seasonStandings]
  );
  const myIndex = sorted.findIndex((s) => s.manager_id === managerId);
  const me = myIndex >= 0 ? sorted[myIndex] : null;
  const leader = sorted[0];

  const myPhases = useMemo(() => {
    const rows = (phaseStandings ?? []).filter((r) => r.manager_id === managerId);
    return rows
      .map((r) => {
        const phase = seasonPhases.find((p) => p.id === r.phase_id);
        const all = (phaseStandings ?? [])
          .filter((x) => x.phase_id === r.phase_id)
          .sort((a, b) => Number(b.total_points) - Number(a.total_points));
        return {
          ...r,
          index: phase?.index_dans_saison ?? 99,
          rank: all.findIndex((x) => x.manager_id === managerId) + 1,
          nbManagers: all.length,
        };
      })
      .filter((r) => r.index !== 99)
      .sort((a, b) => a.index - b.index);
  }, [phaseStandings, managerId, seasonPhases]);

  const pronoStat = (pronostics ?? []).find((p) => p.manager_id === managerId);

  const pronoRate =
    pronoStat && Number(pronoStat.total_count) > 0
      ? Math.round((Number(pronoStat.correct_count) / Number(pronoStat.total_count)) * 100)
      : null;

  const bestPhase = useMemo(
    () =>
      myPhases.reduce<(typeof myPhases)[number] | null>(
        (best, p) => (!best || Number(p.total_points) > Number(best.total_points) ? p : best),
        null
      ),
    [myPhases]
  );



  const topRiders = useMemo(
    () =>
      [...(roster ?? [])].sort(
        (a, b) => Number(b.points_total ?? 0) - Number(a.points_total ?? 0)
      ),
    [roster]
  );

  const totalSpent = (roster ?? []).reduce((s, r) => s + Number(r.prix_achat ?? 0), 0);
  const bestRoi = topRiders.reduce<any>(
    (best, r) =>
      !best || Number(r.ratio_points_par_prix ?? 0) > Number(best.ratio_points_par_prix ?? 0)
        ? r
        : best,
    null
  );

  if (infoLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        {t("managerProfile.back")}
      </Button>

      {/* Header */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 pt-6">
          <Avatar className="h-16 w-16">
            <AvatarImage
              src={sponsor?.jersey_image_url ?? info?.avatar_url ?? undefined}
              alt={info?.nom ?? ""}
            />
            <AvatarFallback>{info?.nom?.[0] ?? "?"}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="font-montserrat text-2xl font-bold">{info?.nom ?? "-"}</h1>
            {(sponsor?.sponsor || info?.sponsor) && (
              <p className="text-sm text-muted-foreground">
                {sponsor?.sponsor || info?.sponsor}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="gap-1">
              <Trophy className="h-3.5 w-3.5" />
              {myIndex >= 0
                ? t("managerProfile.rankOf", { rank: myIndex + 1, total: sorted.length })
                : "-"}
            </Badge>
            <Badge variant="outline">{fmt(me?.total_points)} pts</Badge>
            {leader && me && leader.manager_id !== managerId && (
              <Badge variant="outline" className="text-muted-foreground">
                {t("managerProfile.gapToLeader", {
                  gap: fmt(Number(leader.total_points) - Number(me.total_points)),
                })}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Key stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={Users}
          label={t("managerProfile.scorers")}
          value={fmt(me?.nb_scoreurs)}
        />
        <StatCard
          icon={Trophy}
          label={t("managerProfile.wins")}
          value={fmt(me?.nb_victoires)}
        />
        <StatCard
          icon={Target}
          label={t("managerProfile.pronostics")}
          value={
            pronoStat
              ? `${pronoStat.correct_count}/${pronoStat.total_count}`
              : "-"
          }
        />
        <StatCard
          icon={Coins}
          label={t("managerProfile.bonus")}
          value={fmt(Number(me?.rider_bonus ?? 0) + Number(me?.manager_bonus ?? 0))}
        />
      </div>

      {/* Palmarès & ligues */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-montserrat text-lg">
            <Medal className="h-5 w-5 text-bordure-gold" />
            {t("managerProfile.palmares")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {extraLoading ? (
            <Skeleton className="h-28 w-full" />
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              <MiniStat
                icon={Flag}
                label={t("managerProfile.leaguesCreated")}
                value={fmt(extra?.leagues_created)}
              />
              <MiniStat
                icon={Users}
                label={t("managerProfile.leaguesJoined")}
                value={fmt(extra?.leagues_joined)}
              />
              <MiniStat
                icon={Trophy}
                label={t("managerProfile.leaguesWon")}
                value={fmt(extra?.leagues_won)}
              />
              <MiniStat
                icon={Medal}
                label={t("managerProfile.leaguesPodium")}
                value={fmt(extra?.leagues_podium)}
              />
              <MiniStat
                icon={TrendingUp}
                label={t("managerProfile.bestPhase")}
                value={
                  bestPhase
                    ? `P${bestPhase.index} — ${fmt(bestPhase.total_points)} pts`
                    : "-"
                }
              />
              <MiniStat
                icon={Percent}
                label={t("managerProfile.pronoRate")}
                value={pronoRate == null ? "-" : `${pronoRate} %`}
              />
              <MiniStat
                icon={Star}
                label={t("managerProfile.fetishRider")}
                value={
                  extra?.fetish_rider_nom
                    ? `${extra.fetish_rider_nom} (${fmt(extra.fetish_rider_points)} pts)`
                    : "-"
                }
              />
              <MiniStat
                icon={Repeat}
                label={t("managerProfile.favoriteRider")}
                value={
                  extra?.favorite_rider_nom
                    ? `${extra.favorite_rider_nom} (${t("managerProfile.phasesCount", {
                        count: Number(extra.favorite_rider_count ?? 0),
                      })})`
                    : "-"
                }
              />
            </div>
          )}
        </CardContent>
      </Card>



      {/* Phase by phase */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-montserrat text-lg">
            <TrendingUp className="h-5 w-5 text-bordure-gold" />
            {t("managerProfile.byPhase")}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("managerProfile.phase")}</TableHead>
                <TableHead className="text-right">{t("managerProfile.points")}</TableHead>
                <TableHead className="text-right">{t("managerProfile.rank")}</TableHead>
                <TableHead className="text-right">{t("managerProfile.scorers")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myPhases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    {t("managerProfile.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                myPhases.map((p) => (
                  <TableRow key={p.phase_id}>
                    <TableCell className="font-medium">P{p.index}</TableCell>
                    <TableCell className="text-right">{fmt(p.total_points)}</TableCell>
                    <TableCell className="text-right">
                      {p.rank}/{p.nbManagers}
                    </TableCell>
                    <TableCell className="text-right">{fmt(p.nb_scoreurs)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Roster */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="font-montserrat text-lg">
              {t("managerProfile.roster")}
            </CardTitle>
            <Tabs value={rosterPhaseId} onValueChange={setRosterPhaseId}>
              <TabsList className="flex-wrap">
                <TabsTrigger value="all">{t("managerProfile.allPhases")}</TabsTrigger>
                {seasonPhases.map((p) => (
                  <TabsTrigger key={p.id} value={p.id}>
                    P{p.index_dans_saison}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>
              {t("managerProfile.spent")}: <strong>{fmt(totalSpent)}</strong>
            </span>
            {bestRoi && (
              <span>
                {t("managerProfile.bestRoi")}: <strong>{bestRoi.nom}</strong> (
                {Number(bestRoi.ratio_points_par_prix ?? 0).toFixed(1)})
              </span>
            )}
          </div>
          {rosterLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : topRiders.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t("managerProfile.noData")}
            </p>
          ) : (
            <>
              {/* Mobile: cartes */}
              <div className="space-y-2 md:hidden">
                {topRiders.map((r) => (
                  <div
                    key={`m-${r.coureur_id}-${r.prix_achat}`}
                    className="rounded-md border border-border/60 bg-muted/20 p-2.5"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="min-w-0 flex-1 text-sm font-semibold leading-snug">
                        {r.nom}
                      </p>
                      <p className="shrink-0 text-sm font-bold text-bordure-gold">
                        {fmt(r.points_total)} pts
                      </p>
                    </div>
                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                      {r.equipe}
                    </p>
                    <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                      <span>
                        {t("managerProfile.price")}:{" "}
                        <strong className="text-foreground">{fmt(r.prix_achat)}</strong>
                      </span>
                      <span>
                        {t("managerProfile.roi")}:{" "}
                        <strong className="text-foreground">
                          {Number(r.ratio_points_par_prix ?? 0).toFixed(1)}
                        </strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: tableau */}
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("managerProfile.rider")}</TableHead>
                      <TableHead>{t("managerProfile.team")}</TableHead>
                      <TableHead className="text-right">{t("managerProfile.price")}</TableHead>
                      <TableHead className="text-right">{t("managerProfile.points")}</TableHead>
                      <TableHead className="text-right">{t("managerProfile.roi")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topRiders.map((r) => (
                      <TableRow key={`${r.coureur_id}-${r.prix_achat}`}>
                        <TableCell className="font-medium">{r.nom}</TableCell>
                        <TableCell className="text-muted-foreground">{r.equipe}</TableCell>
                        <TableCell className="text-right">{fmt(r.prix_achat)}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {fmt(r.points_total)}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(r.ratio_points_par_prix ?? 0).toFixed(1)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const StatCard = ({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
}) => (
  <Card>
    <CardContent className="flex items-center gap-3 p-4">
      <Icon className="h-5 w-5 text-bordure-gold" />
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold">{value}</p>
      </div>
    </CardContent>
  </Card>
);

const MiniStat = ({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
}) => (
  <div className="flex items-start gap-2 rounded-md bg-muted/20 p-2">
    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-bordure-gold" />
    <div className="min-w-0 flex-1">
      <p className="text-xs leading-tight text-muted-foreground">{label}</p>
      <p className="break-words text-sm font-semibold leading-snug" title={value}>
        {value}
      </p>
    </div>
  </div>
);
