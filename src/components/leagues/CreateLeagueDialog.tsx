import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useLeague } from "@/contexts/LeagueContext";
import { useUserLeagues } from "@/hooks/useUserLeagues";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const formSchema = z.object({
  name: z.string().min(3, "Le nom doit contenir au moins 3 caractères"),
  visibility: z.enum(["public", "private"]),
});

type FormValues = z.infer<typeof formSchema>;

type CreateLeagueDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateLeagueDialog({ open, onOpenChange }: CreateLeagueDialogProps) {
  const { setLeagueId } = useLeague();
  const { refetch } = useUserLeagues();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      visibility: "private",
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase.functions.invoke('leagues-create', {
        body: {
          name: values.name,
          visibility: values.visibility,
          settings: {},
        },
      });

      if (error) throw error;

      if (data?.league) {
        toast.success("Ligue créée avec succès !");
        
        // Refresh leagues list
        await refetch();
        
        // Switch to new league
        setLeagueId(data.league.id);
        
        // Close dialog and reset form
        onOpenChange(false);
        form.reset();
      }
    } catch (error: any) {
      console.error('Error creating league:', error);
      toast.error(error.message || "Erreur lors de la création de la ligue");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Créer une nouvelle ligue</DialogTitle>
          <DialogDescription>
            Créez votre propre ligue et invitez vos amis à vous rejoindre.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom de la ligue</FormLabel>
                  <FormControl>
                    <Input placeholder="Ma Super Ligue" {...field} />
                  </FormControl>
                  <FormDescription>
                    Choisissez un nom unique pour votre ligue
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="visibility"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Visibilité</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex flex-col space-y-1"
                    >
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="private" />
                        </FormControl>
                        <FormLabel className="font-normal">
                          <span className="font-medium">Privée</span> - Seuls les membres invités peuvent rejoindre
                        </FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="public" />
                        </FormControl>
                        <FormLabel className="font-normal">
                          <span className="font-medium">Publique</span> - Tout le monde peut rejoindre
                        </FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Création..." : "Créer la ligue"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
