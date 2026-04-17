import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LeagueAdminGuard } from "@/components/guards/LeagueAdminGuard";
import { LeagueInvitesManager } from "@/components/admin/LeagueInvitesManager";
import { LeagueDeleteManager } from "@/components/admin/LeagueDeleteManager";
import { LeagueMemberSponsorsManager } from "@/components/admin/LeagueMemberSponsorsManager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

type League = {
  id: string;
  name: string;
  visibility: "public" | "private";
  owner_manager_id: string;
  settings: Record<string, any>;
  created_at: string;
  game_mode: string;
};

type SelectedCourse = {
  id: string;
  nom: string;
  categorie: string | null;
  date_debut: string | null;
  date_fin: string | null;
};

type Member = {
  id: string;
  user_id: string;
  role_in_league: "owner" | "admin" | "member";
  joined_at: string;
  managers?: {
    id: string;
    nom: string;
    email: string | null;
  };
};

export function LeagueDetailPage() {
  const { id: leagueId } = useParams<{ id: string }>();
  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<SelectedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);

  async function loadLeagueData() {
    if (!leagueId) return;
    
    setLoading(true);
    
    // Load league info
    const { data: leagueData, error: leagueError } = await supabase
      .from("leagues")
      .select("*")
      .eq("id", leagueId)
      .single();

    if (leagueError) {
      console.error("Error loading league:", leagueError);
      toast.error("Erreur lors du chargement de la ligue");
      setLeague(null);
      setLoading(false);
      return;
    }

    // Load members - first get league_members, then join with managers separately
    const { data: membersData, error: membersError } = await supabase
      .from("league_members")
      .select("*")
      .eq("league_id", leagueId)
      .order("role_in_league", { ascending: true });

    if (membersError) {
      console.error("Error loading members:", membersError);
      toast.error("Erreur lors du chargement des membres");
    }

    // Fetch manager details for each member
    const membersWithManagers: Member[] = [];
    if (membersData) {
      for (const member of membersData) {
        const { data: managerData } = await supabase
          .from("managers")
          .select("id, nom, email")
          .eq("user_id", member.user_id)
          .single();

        membersWithManagers.push({
          ...member,
          role_in_league: member.role_in_league as "owner" | "admin" | "member",
          managers: managerData || undefined,
        } as Member);
      }
    }

    // Load selected courses if league is per_course
    let coursesList: SelectedCourse[] = [];
    if ((leagueData as any)?.game_mode === "per_course") {
      const { data: scopeData } = await supabase
        .from("league_scopes")
        .select("selected_course_ids")
        .eq("league_id", leagueId)
        .maybeSingle();

      const ids = (scopeData?.selected_course_ids as string[] | null) ?? [];
      if (ids.length > 0) {
        const { data: coursesData } = await supabase
          .from("courses")
          .select("id, nom, categorie, date_debut, date_fin")
          .in("id", ids)
          .order("date_debut", { ascending: true });
        coursesList = (coursesData ?? []) as SelectedCourse[];
      }
    }

    setLeague(leagueData as League);
    setMembers(membersWithManagers);
    setSelectedCourses(coursesList);
    setLoading(false);
  }

  useEffect(() => {
    loadLeagueData();
  }, [leagueId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-pulse text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  if (!league || !leagueId) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Ligue introuvable</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  async function updateRole(userId: string, newRole: "owner" | "admin" | "member") {
    setBusyMemberId(userId);
    
    const { error } = await supabase
      .from("league_members")
      .update({ role_in_league: newRole })
      .eq("league_id", leagueId)
      .eq("user_id", userId);

    setBusyMemberId(null);

    if (error) {
      console.error("Error updating role:", error);
      toast.error("Erreur lors de la mise à jour du rôle");
      return;
    }

    toast.success("Rôle mis à jour");
    loadLeagueData();
  }

  async function removeMember(userId: string) {
    if (!confirm("Voulez-vous vraiment retirer ce membre ?")) return;

    setBusyMemberId(userId);

    const { error } = await supabase
      .from("league_members")
      .delete()
      .eq("league_id", leagueId)
      .eq("user_id", userId);

    setBusyMemberId(null);

    if (error) {
      console.error("Error removing member:", error);
      toast.error("Erreur lors de la suppression du membre");
      return;
    }

    toast.success("Membre retiré");
    loadLeagueData();
  }

  return (
    <LeagueAdminGuard leagueId={leagueId}>
      <div className="space-y-6 p-3 sm:p-0">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{league.name}</h1>
            <p className="text-muted-foreground mt-1">
              Gestion de la ligue
            </p>
          </div>
          <Badge variant={league.visibility === "public" ? "default" : "secondary"}>
            {league.visibility === "public" ? "Publique" : "Privée"}
          </Badge>
        </div>

        {/* League Settings */}
        <LeagueSettingsCard league={league} onSaved={loadLeagueData} />

        {/* Selected Courses (per_course mode) */}
        {league.game_mode === "per_course" && (
          <SelectedCoursesCard courses={selectedCourses} />
        )}

        {/* Invitations */}
        <LeagueInvitesManager leagueId={leagueId} />

        {/* Member Sponsors */}
        <LeagueMemberSponsorsManager leagueId={leagueId} />

        {/* Members Management */}
        <Card>
          <CardHeader>
            <CardTitle>Membres ({members.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Manager</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.managers?.nom || "N/A"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.managers?.email || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {member.role_in_league === "owner" && "👑 Owner"}
                        {member.role_in_league === "admin" && "⚙️ Admin"}
                        {member.role_in_league === "member" && "👤 Membre"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyMemberId === member.user_id || member.role_in_league === "member"}
                        onClick={() => updateRole(member.user_id, "member")}
                      >
                        Membre
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyMemberId === member.user_id || member.role_in_league === "admin"}
                        onClick={() => updateRole(member.user_id, "admin")}
                      >
                        Admin
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busyMemberId === member.user_id || member.role_in_league === "owner"}
                        onClick={() => removeMember(member.user_id)}
                      >
                        Retirer
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Delete League Section */}
        <LeagueDeleteManager league={league} />
      </div>
    </LeagueAdminGuard>
  );
}

function LeagueSettingsCard({
  league,
  onSaved,
}: {
  league: League;
  onSaved: () => void;
}) {
  const [name, setName] = useState(league.name);
  const [visibility, setVisibility] = useState(league.visibility);
  const [saving, setSaving] = useState(false);

  async function saveSettings() {
    setSaving(true);

    const { error } = await supabase
      .from("leagues")
      .update({ name, visibility })
      .eq("id", league.id);

    setSaving(false);

    if (error) {
      console.error("Error updating league:", error);
      toast.error("Erreur lors de la mise à jour");
      return;
    }

    toast.success("Paramètres enregistrés");
    onSaved();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Paramètres de la ligue</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="league-name">Nom de la ligue</Label>
            <Input
              id="league-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom de la ligue"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="league-visibility">Visibilité</Label>
            <Select value={visibility} onValueChange={(v: any) => setVisibility(v)}>
              <SelectTrigger id="league-visibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Publique</SelectItem>
                <SelectItem value="private">Privée</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={saveSettings} disabled={saving}>
          {saving ? "Enregistrement..." : "Enregistrer les modifications"}
        </Button>
      </CardContent>
    </Card>
  );
}

function SelectedCoursesCard({ courses }: { courses: SelectedCourse[] }) {
  function formatDateRange(start: string | null, end: string | null) {
    if (!start) return "-";
    const fmt = (d: string) =>
      new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
    if (!end || end === start) return fmt(start);
    return `${fmt(start)} → ${fmt(end)}`;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Courses sélectionnées ({courses.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {courses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune course sélectionnée pour cette ligue.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Dates</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nom}</TableCell>
                  <TableCell>
                    {c.categorie ? <Badge variant="outline">{c.categorie}</Badge> : "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateRange(c.date_debut, c.date_fin)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
