import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Clock, CheckCircle, Lock, Trash2, Loader2 } from "lucide-react";
import { type PollWithDetails, useVote, useDeletePoll, useLeagueManagers } from "@/hooks/useArenaPolls";
import { toast } from "sonner";
import { isPast, formatDistanceToNow } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface PollCardProps {
  poll: PollWithDetails;
  managerId: string;
  leagueId: string;
  isAdmin: boolean;
}

export const PollCard = ({ poll, managerId, leagueId, isAdmin }: PollCardProps) => {
  const { t, i18n } = useTranslation("arena");
  const dateLocale = i18n.language === "fr" ? fr : enUS;
  const vote = useVote();
  const deletePoll = useDeletePoll();
  const { data: managers } = useLeagueManagers(leagueId);

  const isClosed = isPast(new Date(poll.closes_at));
  const hasVoted = !!poll.myVote;

  const pollTypeLabel = useMemo(() => {
    switch (poll.poll_type) {
      case "mvp": return t("votes.pollTypes.mvp");
      case "flop": return t("votes.pollTypes.flop");
      case "best_move": return t("votes.pollTypes.bestMove");
      case "worst_buy": return t("votes.pollTypes.worstBuy");
      case "custom": return t("votes.pollTypes.custom");
      default: return poll.poll_type;
    }
  }, [poll.poll_type, t]);

  const handleVote = async (optionId: string) => {
    if (hasVoted || isClosed) return;
    try {
      await vote.mutateAsync({ pollId: poll.id, optionId, managerId });
      toast.success(t("votes.voteSuccess"));
    } catch (error: any) {
      if (error?.code === "23505") {
        toast.error(t("votes.alreadyVoted"));
      } else {
        toast.error(t("votes.voteError"));
      }
    }
  };

  const handleDelete = async () => {
    try {
      await deletePoll.mutateAsync(poll.id);
      toast.success(t("votes.deleteSuccess"));
    } catch {
      toast.error(t("votes.deleteError"));
    }
  };

  // Find manager avatar for manager-type options
  const getManagerAvatar = (mId: string | null) => {
    if (!mId || !managers) return null;
    return managers.find((m) => m.id === mId);
  };

  // Determine the winner option(s)
  const winnerOptionId = useMemo(() => {
    if (!isClosed || poll.totalVotes === 0) return null;
    let maxCount = 0;
    let winnerId: string | null = null;
    for (const opt of poll.options) {
      const count = poll.voteCounts[opt.id] || 0;
      if (count > maxCount) {
        maxCount = count;
        winnerId = opt.id;
      }
    }
    return winnerId;
  }, [isClosed, poll]);

  return (
    <Card className={cn(
      "transition-all",
      isClosed ? "bg-muted/30" : "hover:shadow-md"
    )}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm">{poll.title}</h4>
            {poll.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{poll.description}</p>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className="text-xs">{pollTypeLabel}</Badge>
              {isClosed ? (
                <Badge variant="secondary" className="text-xs">
                  <Lock className="h-3 w-3 mr-1" />
                  {t("votes.status.closed")}
                </Badge>
              ) : (
                <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                  <Clock className="h-3 w-3 mr-1" />
                  {t("votes.status.open")}
                </Badge>
              )}
            </div>
          </div>

          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={deletePoll.isPending}
            >
              {deletePoll.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 text-destructive" />
              )}
            </Button>
          )}
        </div>

        {/* Deadline info */}
        <div className="text-xs text-muted-foreground">
          <Clock className="h-3 w-3 inline mr-1" />
          {isClosed
            ? t("votes.closedAgo", {
                time: formatDistanceToNow(new Date(poll.closes_at), { addSuffix: true, locale: dateLocale }),
              })
            : t("votes.closesIn", {
                time: formatDistanceToNow(new Date(poll.closes_at), { addSuffix: false, locale: dateLocale }),
              })}
        </div>

        {/* Options / Results */}
        <div className="space-y-2">
          {poll.options.map((option) => {
            const count = poll.voteCounts[option.id] || 0;
            const pct = poll.totalVotes > 0 ? Math.round((count / poll.totalVotes) * 100) : 0;
            const isMyVote = poll.myVote?.option_id === option.id;
            const isWinner = winnerOptionId === option.id && isClosed;
            const manager = getManagerAvatar(option.manager_id);
            const showResults = isClosed || hasVoted;

            return (
              <div key={option.id} className="relative">
                {showResults ? (
                  // Results view
                  <div className={cn(
                    "rounded-lg border p-3 space-y-1.5",
                    isWinner && "border-primary bg-primary/5",
                    isMyVote && "ring-1 ring-primary/50"
                  )}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {manager && (
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={manager.avatar_url || undefined} />
                            <AvatarFallback className="text-[10px]">
                              {manager.nom.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <span className="text-sm font-medium truncate">{option.label}</span>
                        {isMyVote && <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />}
                      </div>
                      <span className="text-sm font-semibold text-muted-foreground shrink-0">
                        {pct}% ({count})
                      </span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                ) : (
                  // Voting view
                  <button
                    onClick={() => handleVote(option.id)}
                    disabled={vote.isPending}
                    className={cn(
                      "w-full rounded-lg border p-3 text-left flex items-center gap-2 transition-colors",
                      "hover:border-primary hover:bg-primary/5 active:scale-[0.99]"
                    )}
                  >
                    {manager && (
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={manager.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px]">
                          {manager.nom.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <span className="text-sm font-medium">{option.label}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Vote count */}
        {(isClosed || hasVoted) && (
          <p className="text-xs text-muted-foreground text-center">
            {t("votes.totalVotes", { count: poll.totalVotes })}
          </p>
        )}

        {/* Pending indicator */}
        {vote.isPending && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground justify-center">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t("votes.voting")}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
