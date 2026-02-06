import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2, X } from "lucide-react";
import { useCreatePoll, useLeagueManagers, POLL_TYPES } from "@/hooks/useArenaPolls";
import { toast } from "sonner";

interface CreatePollDialogProps {
  leagueId: string;
  managerId: string;
}

export const CreatePollDialog = ({ leagueId, managerId }: CreatePollDialogProps) => {
  const { t } = useTranslation("arena");
  const createPoll = useCreatePoll();
  const { data: managers } = useLeagueManagers(leagueId);

  const [open, setOpen] = useState(false);
  const [pollType, setPollType] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [closesDate, setClosesDate] = useState("");
  const [closesTime, setClosesTime] = useState("23:59");
  const [customOptions, setCustomOptions] = useState<string[]>([""]);

  const isCustom = pollType === "custom";
  const isManagerType = !isCustom && !!pollType;

  const resetForm = () => {
    setPollType("");
    setTitle("");
    setDescription("");
    setClosesDate("");
    setClosesTime("23:59");
    setCustomOptions([""]);
  };

  const addCustomOption = () => {
    setCustomOptions((prev) => [...prev, ""]);
  };

  const updateCustomOption = (index: number, value: string) => {
    setCustomOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  };

  const removeCustomOption = (index: number) => {
    setCustomOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!pollType || !title.trim() || !closesDate) {
      toast.error(t("votes.create.requiredFields"));
      return;
    }

    const validCustomOptions = customOptions.filter((o) => o.trim());
    if (isCustom && validCustomOptions.length < 2) {
      toast.error(t("votes.create.minOptions"));
      return;
    }

    const closesAt = new Date(`${closesDate}T${closesTime}:00`).toISOString();

    try {
      await createPoll.mutateAsync({
        leagueId,
        managerId,
        pollType,
        title: title.trim(),
        description: description.trim() || undefined,
        closesAt,
        optionsType: isCustom ? "custom" : "managers",
        customOptions: isCustom ? validCustomOptions : undefined,
        managerOptions: isManagerType ? (managers || []).map((m) => ({ id: m.id, nom: m.nom })) : undefined,
      });
      toast.success(t("votes.create.success"));
      resetForm();
      setOpen(false);
    } catch {
      toast.error(t("votes.create.error"));
    }
  };

  // Auto-fill title when selecting predefined type
  const handleTypeChange = (value: string) => {
    setPollType(value);
    if (value !== "custom" && !title.trim()) {
      const typeConfig = POLL_TYPES.find((p) => p.value === value);
      if (typeConfig) {
        setTitle(t(typeConfig.labelKey));
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          {t("votes.create.button")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("votes.create.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Poll Type */}
          <div className="space-y-2">
            <Label>{t("votes.create.type")} *</Label>
            <Select value={pollType} onValueChange={handleTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder={t("votes.create.selectType")} />
              </SelectTrigger>
              <SelectContent>
                {POLL_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {t(type.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isManagerType && (
              <p className="text-xs text-muted-foreground">
                {t("votes.create.autoManagerOptions", { count: managers?.length || 0 })}
              </p>
            )}
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label>{t("votes.create.pollTitle")} *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("votes.create.titlePlaceholder")}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>{t("votes.create.description")}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("votes.create.descriptionPlaceholder")}
              rows={2}
            />
          </div>

          {/* Custom Options */}
          {isCustom && (
            <div className="space-y-2">
              <Label>{t("votes.create.options")} *</Label>
              {customOptions.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={opt}
                    onChange={(e) => updateCustomOption(i, e.target.value)}
                    placeholder={`${t("votes.create.option")} ${i + 1}`}
                  />
                  {customOptions.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCustomOption(i)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addCustomOption}>
                <Plus className="h-3 w-3 mr-1" />
                {t("votes.create.addOption")}
              </Button>
            </div>
          )}

          {/* Closes At */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("votes.create.closesDate")} *</Label>
              <Input
                type="date"
                value={closesDate}
                onChange={(e) => setClosesDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("votes.create.closesTime")}</Label>
              <Input
                type="time"
                value={closesTime}
                onChange={(e) => setClosesTime(e.target.value)}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("votes.create.cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={createPoll.isPending}>
              {createPoll.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("votes.create.submit")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
