import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Vote } from "lucide-react";

interface VotesTabProps {
  leagueId: string;
}

export const VotesTab = ({ leagueId }: VotesTabProps) => {
  const { t } = useTranslation("arena");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Vote className="h-5 w-5" />
          {t("votes.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Vote className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">{t("votes.comingSoon")}</p>
          <p className="text-sm">{t("votes.comingSoonDesc")}</p>
        </div>
      </CardContent>
    </Card>
  );
};
