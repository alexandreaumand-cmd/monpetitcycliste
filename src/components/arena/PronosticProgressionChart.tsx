import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Line, LineChart, XAxis, YAxis, CartesianGrid } from "recharts";
import { usePronosticProgression } from "@/hooks/useArenaPronostics";

interface Props {
  leagueId: string;
  courseId?: string | null;
}

const PALETTE = [
  "hsl(var(--bordure-gold))",
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--destructive))",
  "hsl(var(--muted-foreground))",
];

export const PronosticProgressionChart = ({ leagueId, courseId }: Props) => {
  const { t } = useTranslation("arena");
  const { data, isLoading } = usePronosticProgression(leagueId, courseId, 5);

  const chartConfig: ChartConfig = {};
  (data?.managers || []).forEach((m, i) => {
    chartConfig[m.nom] = { label: m.nom, color: PALETTE[i % PALETTE.length] };
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4" />
          {t("pronostics.progression.title", { defaultValue: "Évolution des points" })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : !data || data.points.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {t("pronostics.progression.empty", {
              defaultValue: "Pas encore de pronostics évalués.",
            })}
          </p>
        ) : (
          <ChartContainer config={chartConfig} className="h-64 w-full">
            <LineChart data={data.points} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
                angle={-25}
                textAnchor="end"
                height={50}
              />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} width={28} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              {(data.managers || []).map((m, i) => (
                <Line
                  key={m.id}
                  type="monotone"
                  dataKey={m.nom}
                  stroke={PALETTE[i % PALETTE.length]}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};
