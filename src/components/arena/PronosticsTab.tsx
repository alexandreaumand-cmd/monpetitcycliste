import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";

interface PronosticsTabProps {
  leagueId: string;
}

export const PronosticsTab = ({ leagueId }: PronosticsTabProps) => {
  const { t } = useTranslation("arena");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          {t("pronostics.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Target className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">{t("pronostics.comingSoon")}</p>
          <p className="text-sm">{t("pronostics.comingSoonDesc")}</p>
        </div>
      </CardContent>
    </Card>
  );
};
