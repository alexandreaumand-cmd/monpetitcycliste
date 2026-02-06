import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Hash, Radio } from "lucide-react";

interface ChannelSelectorProps {
  activeChannel: string;
  onSelect: (slug: string) => void;
}

export const ChannelSelector = ({ activeChannel, onSelect }: ChannelSelectorProps) => {
  const { t } = useTranslation("arena");

  const channels = [
    { slug: "general", label: t("trashTalk.channels.general"), icon: Hash },
    { slug: "live-courses", label: t("trashTalk.channels.liveCourses"), icon: Radio },
  ];

  return (
    <div className="flex gap-1 p-1 bg-muted rounded-lg">
      {channels.map((ch) => (
        <button
          key={ch.slug}
          onClick={() => onSelect(ch.slug)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
            activeChannel === ch.slug
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <ch.icon className="h-3.5 w-3.5" />
          {ch.label}
        </button>
      ))}
    </div>
  );
};
