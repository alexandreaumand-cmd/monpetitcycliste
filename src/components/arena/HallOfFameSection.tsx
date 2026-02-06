import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown } from "lucide-react";

interface HallOfFameSectionProps {
  leagueId: string;
}

export const HallOfFameSection = ({ leagueId }: HallOfFameSectionProps) => {
  const { t } = useTranslation("arena");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5" />
          {t("hallOfFame.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Crown className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">{t("hallOfFame.comingSoon")}</p>
          <p className="text-sm">{t("hallOfFame.comingSoonDesc")}</p>
        </div>
      </CardContent>
    </Card>
  );
};
