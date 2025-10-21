import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Copy, Ban } from "lucide-react";

type Invite = {
  id: string;
  token: string;
  expires_at: string | null;
  max_uses: number | null;
  uses_count: number;
  note: string | null;
  is_revoked: boolean;
  created_at: string;
};

export function LeagueInvitesManager({ leagueId }: { leagueId: string }) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  
  const [expiresAt, setExpiresAt] = useState("");
  const [maxUses, setMaxUses] = useState<number | "">("");
  const [note, setNote] = useState("");

  async function loadInvites() {
    setLoading(true);

    if (!leagueId) {
      toast.error("Aucune ligue sélectionnée");
      setLoading(false);
      return;
    }
    
    const { data, error } = await supabase.functions.invoke('leagues-list-invites', {
      body: { league_id: leagueId },
    });

    if (error || data?.error) {
      const msg = (data as any)?.error || (error as any)?.message || "Erreur lors du chargement des invitations";
      console.error('Error loading invites:', error || data?.error);
      toast.error(msg);
      setLoading(false);
      return;
    }

    setInvites(data?.invites || []);
    setLoading(false);
  }

  useEffect(() => {
    loadInvites();
  }, [leagueId]);

  async function createInvite() {
    setCreating(true);

    const { data, error } = await supabase.functions.invoke('leagues-create-invite', {
      body: {
        league_id: leagueId,
        expires_at: expiresAt || null,
        max_uses: maxUses === "" ? null : Number(maxUses),
        note,
      },
    });

    setCreating(false);

    if (error || data?.error) {
      console.error('Error creating invite:', error || data?.error);
      toast.error(data?.error || "Erreur lors de la création");
      return;
    }

    if (data?.token) {
      const inviteUrl = `${window.location.origin}/join?token=${data.token}`;
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("Lien copié dans le presse-papiers !");
    }

    setExpiresAt("");
    setMaxUses("");
    setNote("");
    loadInvites();
  }

  async function revokeInvite(token: string) {
    if (!confirm("Voulez-vous vraiment révoquer cette invitation ?")) return;

    const { data, error } = await supabase.functions.invoke('leagues-revoke-invite', {
      body: { league_id: leagueId, token },
    });

    if (error || data?.error) {
      console.error('Error revoking invite:', error || data?.error);
      toast.error(data?.error || "Erreur lors de la révocation");
      return;
    }

    toast.success("Invitation révoquée");
    loadInvites();
  }

  async function copyLink(token: string) {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/join?token=${token}`;
    await navigator.clipboard.writeText(url);
    toast.success("Lien copié !");
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="animate-pulse text-muted-foreground">Chargement...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invitations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="expires_at">Expiration</Label>
            <Input
              id="expires_at"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max_uses">Max utilisations</Label>
            <Input
              id="max_uses"
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value ? Number(e.target.value) : "")}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="note">Note</Label>
            <Input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note interne (optionnel)"
            />
          </div>
        </div>

        <Button onClick={createInvite} disabled={creating}>
          {creating ? "Création..." : "Créer un lien d'invitation"}
        </Button>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Token</TableHead>
                <TableHead>Expire</TableHead>
                <TableHead>Utilisations</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Aucune invitation
                  </TableCell>
                </TableRow>
              ) : (
                invites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell className="font-mono text-xs">
                      {invite.token.slice(0, 12)}…
                    </TableCell>
                    <TableCell>
                      {invite.expires_at
                        ? new Date(invite.expires_at).toLocaleString()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {invite.uses_count}
                      {invite.max_uses ? ` / ${invite.max_uses}` : ""}
                    </TableCell>
                    <TableCell>{invite.note || "—"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyLink(invite.token)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={invite.is_revoked}
                        onClick={() => revokeInvite(invite.token)}
                      >
                        {invite.is_revoked ? (
                          "Révoqué"
                        ) : (
                          <>
                            <Ban className="h-4 w-4 mr-1" />
                            Révoquer
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
