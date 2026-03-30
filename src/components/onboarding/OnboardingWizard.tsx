import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { onboardingSteps } from "./onboardingSteps";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingWizardProps {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { i18n } = useTranslation();
  const [step, setStep] = useState(0);
  const isFr = i18n.language?.startsWith("fr");
  const total = onboardingSteps.length;
  const current = onboardingSteps[step];
  const Icon = current.icon;

  const progress = ((step + 1) / total) * 100;

  const handleComplete = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("onboarding_progress").insert({ user_id: user.id });
      }
    } catch (e) {
      console.error("Error saving onboarding progress:", e);
    }
    onComplete();
  };

  const handleSkip = async () => {
    await handleComplete();
  };

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        className="max-w-md p-0 gap-0 overflow-hidden border-0 [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Header with step indicator */}
        <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-8">
          <button
            onClick={handleSkip}
            className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted/80 transition-colors text-muted-foreground"
            aria-label="Passer"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="text-xs font-medium text-muted-foreground mb-4">
            {step + 1} / {total}
          </div>

          <div className="flex items-center justify-center">
            <div className={cn(
              "w-20 h-20 rounded-2xl flex items-center justify-center",
              "bg-primary/15 text-primary shadow-sm"
            )}>
              <Icon className="h-10 w-10" />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 text-center space-y-2">
          <h3 className="text-xl font-bold text-foreground">
            {isFr ? current.titleFr : current.titleEn}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isFr ? current.descriptionFr : current.descriptionEn}
          </p>
        </div>

        {/* Progress + navigation */}
        <div className="px-6 pb-6 space-y-4">
          <Progress value={progress} className="h-1.5" />

          <div className="flex items-center gap-2">
            {step > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(step - 1)}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                {isFr ? "Précédent" : "Previous"}
              </Button>
            ) : (
              <div />
            )}

            <div className="flex-1" />

            {step < total - 1 ? (
              <Button
                size="sm"
                onClick={() => setStep(step + 1)}
                className="gap-1"
              >
                {isFr ? "Suivant" : "Next"}
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleComplete}
                className="gap-1"
              >
                {isFr ? "C'est parti ! 🚴" : "Let's go! 🚴"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
