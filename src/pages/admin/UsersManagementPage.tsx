import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { UserPlus, Key, Ban, CheckCircle, Mail, Shield, Users, Activity, Copy, Eye, Clock, Calendar, ArrowUpDown, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface UserActivity {
  total_page_views: number;
  total_sessions: number;
  pages_today: number;
  pages_last_7_days: number;
  pages_last_30_days: number;
  sessions_today: number;
  sessions_last_7_days: number;
  last_page_path: string | null;
  last_activity_at: string | null;
  avg_session_duration_seconds: number;
}

interface UserData {
  user_id: string;
  email: string;
  manager_id: string | null;
  manager_name: string | null;
  is_superadmin: boolean;
  league_count: number;
  league_admin_count: number;
  league_roles: Array<{
    league_id: string;
    league_name: string;
    role: 'owner' | 'admin' | 'member';
  }>;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  banned_until: string | null;
  created_at: string;
  activity: UserActivity;
}

type FilterStatus = 'all' | 'active' | 'unconfirmed' | 'banned' | 'superadmins' | 'leagueadmins';

export default function UsersManagementPage() {
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [newRole, setNewRole] = useState<string>("user");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Create user dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserManagerName, setNewUserManagerName] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'superadmin'>('user');
  const [sendInvitation, setSendInvitation] = useState(true);
  
  // Reset password dialog state
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<UserData | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);
  
  // Ban confirmation dialog state
  const [banConfirmDialogOpen, setBanConfirmDialogOpen] = useState(false);
  const [banTargetUser, setBanTargetUser] = useState<UserData | null>(null);
  const [banAction, setBanAction] = useState<boolean>(false);
  
  // Delete confirmation dialog state
  const [deleteConfirmDialogOpen, setDeleteConfirmDialogOpen] = useState(false);
  const [deleteTargetUser, setDeleteTargetUser] = useState<UserData | null>(null);
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState<'last_connection' | 'created_at' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);

  // Fetch users
  const { data: users, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-users-list'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-users-list');
      if (error) throw error;
      return data.users as UserData[];
    }
  });

  // Set role mutation
  const setRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { data, error } = await supabase.functions.invoke('admin-user-set-role', {
        body: { user_id: userId, role }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Rôle mis à jour avec succès");
      queryClient.invalidateQueries({ queryKey: ['admin-users-list'] });
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast.error(`Erreur: ${error.message}`);
    }
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.functions.invoke('admin-user-reset-password', {
        body: { email }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Email de réinitialisation envoyé");
      setResetLink(data.reset_link);
    },
    onError: (error: any) => {
      toast.error(`Erreur: ${error.message}`);
      setResetPasswordDialogOpen(false);
    }
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: { email: string; manager_name: string; role: string; send_invitation: boolean }) => {
      const { data, error } = await supabase.functions.invoke('admin-user-create', {
        body: userData
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Utilisateur créé avec succès");
      if (data.invitation_link) {
        navigator.clipboard.writeText(data.invitation_link);
        toast.info("Lien d'invitation copié dans le presse-papiers");
      }
      queryClient.invalidateQueries({ queryKey: ['admin-users-list'] });
      setCreateDialogOpen(false);
      setNewUserEmail('');
      setNewUserManagerName('');
      setNewUserRole('user');
      setSendInvitation(true);
    },
    onError: (error: any) => {
      toast.error(`Erreur: ${error.message}`);
    }
  });

  // Toggle ban mutation
  const toggleBanMutation = useMutation({
    mutationFn: async ({ userId, ban }: { userId: string; ban: boolean }) => {
      const { data, error } = await supabase.functions.invoke('admin-user-toggle-ban', {
        body: { user_id: userId, ban }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(banAction ? "Utilisateur suspendu" : "Utilisateur réactivé");
      queryClient.invalidateQueries({ queryKey: ['admin-users-list'] });
      setBanConfirmDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(`Erreur: ${error.message}`);
      setBanConfirmDialogOpen(false);
    }
  });

  // Resend confirmation mutation
  const resendConfirmationMutation = useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.functions.invoke('admin-user-resend-confirmation', {
        body: { email }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Email de confirmation renvoyé");
    },
    onError: (error: any) => {
      toast.error(`Erreur: ${error.message}`);
    }
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('admin-user-delete', {
        body: { user_id: userId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Utilisateur supprimé avec succès");
      queryClient.invalidateQueries({ queryKey: ['admin-users-list'] });
      setDeleteConfirmDialogOpen(false);
      setDeleteTargetUser(null);
    },
    onError: (error: any) => {
      toast.error(`Erreur: ${error.message}`);
      setDeleteConfirmDialogOpen(false);
    }
  });

  const handleEditRole = (user: UserData) => {
    setSelectedUser(user);
    setNewRole(user.is_superadmin ? 'superadmin' : 'user');
  };

  const handleSaveRole = () => {
    if (selectedUser) {
      setRoleMutation.mutate({
        userId: selectedUser.user_id,
        role: newRole
      });
    }
  };

  const handleResetPassword = (user: UserData) => {
    setResetPasswordUser(user);
    setResetLink(null);
    setResetPasswordDialogOpen(true);
  };

  const handleConfirmResetPassword = () => {
    if (resetPasswordUser) {
      resetPasswordMutation.mutate(resetPasswordUser.email);
    }
  };

  const handleCreateUser = () => {
    createUserMutation.mutate({
      email: newUserEmail,
      manager_name: newUserManagerName,
      role: newUserRole,
      send_invitation: sendInvitation
    });
  };

  const handleToggleBan = (user: UserData, ban: boolean) => {
    setBanTargetUser(user);
    setBanAction(ban);
    setBanConfirmDialogOpen(true);
  };

  const handleConfirmToggleBan = () => {
    if (banTargetUser) {
      toggleBanMutation.mutate({
        userId: banTargetUser.user_id,
        ban: banAction
      });
    }
  };

  const handleDeleteUser = (user: UserData) => {
    setDeleteTargetUser(user);
    setDeleteConfirmDialogOpen(true);
  };

  const handleConfirmDeleteUser = () => {
    if (deleteTargetUser) {
      deleteUserMutation.mutate(deleteTargetUser.user_id);
    }
  };

  const getUserStatus = (user: UserData): { label: string; variant: 'default' | 'secondary' | 'destructive' } => {
    if (user.banned_until) {
      return { label: 'Suspendu', variant: 'destructive' };
    }
    if (!user.email_confirmed_at) {
      return { label: 'Non confirmé', variant: 'secondary' };
    }
    return { label: 'Actif', variant: 'default' };
  };

  const filteredUsers = users?.filter(user => {
    // Search filter
    const matchesSearch = !searchQuery || 
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.manager_name?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // Status filter
    switch (filterStatus) {
      case 'active':
        return user.email_confirmed_at && !user.banned_until;
      case 'unconfirmed':
        return !user.email_confirmed_at;
      case 'banned':
        return !!user.banned_until;
      case 'superadmins':
        return user.is_superadmin;
      case 'leagueadmins':
        return user.league_admin_count > 0;
      default:
        return true;
    }
  });

  // Sort users
  const sortedUsers = filteredUsers ? [...filteredUsers].sort((a, b) => {
    if (!sortDirection || !sortColumn) return 0;

    let dateA: string | null = null;
    let dateB: string | null = null;

    if (sortColumn === 'last_connection') {
      const getLastActivityDate = (user: UserData) =>
        user.activity?.last_activity_at || user.last_sign_in_at || null;
      dateA = getLastActivityDate(a);
      dateB = getLastActivityDate(b);
    } else if (sortColumn === 'created_at') {
      dateA = a.created_at || null;
      dateB = b.created_at || null;
    }

    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;

    const comparison = new Date(dateA).getTime() - new Date(dateB).getTime();
    return sortDirection === 'asc' ? comparison : -comparison;
  }) : [];

  const handleSort = (column: 'last_connection' | 'created_at') => {
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDirection('desc');
      return;
    }
    if (sortDirection === 'desc') {
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection(null);
      setSortColumn(null);
    } else {
      setSortDirection('desc');
    }
  };

  const stats = {
    total: users?.length || 0,
    superAdmins: users?.filter(u => u.is_superadmin).length || 0,
    leagueAdmins: users?.filter(u => u.league_admin_count > 0).length || 0,
    active: users?.filter(u => u.email_confirmed_at && !u.banned_until).length || 0,
    unconfirmed: users?.filter(u => !u.email_confirmed_at).length || 0,
    banned: users?.filter(u => u.banned_until).length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Gestion des utilisateurs</h1>
          <p className="text-sm text-muted-foreground">Gérez les rôles, permissions et accès des utilisateurs</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Créer un utilisateur
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer un nouvel utilisateur</DialogTitle>
              <DialogDescription>
                Créez un nouveau compte utilisateur et profil manager
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-email">Email *</Label>
                <Input
                  id="new-email"
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="email@exemple.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-manager-name">Nom du manager *</Label>
                <Input
                  id="new-manager-name"
                  value={newUserManagerName}
                  onChange={(e) => setNewUserManagerName(e.target.value)}
                  placeholder="Nom du manager"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-role">Rôle</Label>
                <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as 'user' | 'superadmin')}>
                  <SelectTrigger id="new-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Utilisateur</SelectItem>
                    <SelectItem value="superadmin">Super Administrateur</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="send-invitation"
                  checked={sendInvitation}
                  onCheckedChange={setSendInvitation}
                />
                <Label htmlFor="send-invitation">Envoyer un email d'invitation</Label>
              </div>
              {!sendInvitation && (
                <p className="text-sm text-muted-foreground">
                  Un mot de passe temporaire sera généré automatiquement
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Annuler
              </Button>
              <Button 
                onClick={handleCreateUser}
                disabled={!newUserEmail || !newUserManagerName || createUserMutation.isPending}
              >
                {createUserMutation.isPending ? "Création..." : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between">
            <span>Impossible de charger les utilisateurs: {(error as any)?.message || 'Erreur inconnue'}</span>
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? 'Chargement...' : 'Réessayer'}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid gap-3 grid-cols-3 md:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isError ? '—' : stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Super Admins</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isError ? '—' : stats.superAdmins}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">League Admins</CardTitle>
            <Shield className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isError ? '—' : stats.leagueAdmins}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actifs</CardTitle>
            <Activity className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isError ? '—' : stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Non confirmés</CardTitle>
            <Mail className="h-4 w-4 text-bordure-gold" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isError ? '—' : stats.unconfirmed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspendus</CardTitle>
            <Ban className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isError ? '—' : stats.banned}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des utilisateurs</CardTitle>
          <CardDescription>Filtrez et gérez les comptes utilisateurs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex-1">
              <Input
                placeholder="Rechercher par email ou nom..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="active">Actifs</SelectItem>
                <SelectItem value="unconfirmed">Non confirmés</SelectItem>
                <SelectItem value="banned">Suspendus</SelectItem>
                <SelectItem value="superadmins">Super Admins</SelectItem>
                <SelectItem value="leagueadmins">League Admins</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Users Table */}
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">Email</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Manager</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Statut</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Rôle</th>
                    <th className="hidden sm:table-cell px-4 py-3 text-left text-sm font-medium">Ligues</th>
                    <th className="hidden sm:table-cell px-4 py-3 text-left text-sm font-medium">Activité</th>
                    <th 
                      className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-muted/80 select-none"
                      onClick={handleSortByLastConnection}
                    >
                      <div className="flex items-center gap-1">
                        Dernière connexion
                        {sortDirection === null && <ArrowUpDown className="h-4 w-4 text-muted-foreground" />}
                        {sortDirection === 'desc' && <ArrowDown className="h-4 w-4" />}
                        {sortDirection === 'asc' && <ArrowUp className="h-4 w-4" />}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sortedUsers?.map((user) => {
                    const status = getUserStatus(user);
                    const activity = user.activity;
                    const formatDuration = (seconds: number) => {
                      if (seconds < 60) return `${Math.round(seconds)}s`;
                      if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
                      return `${Math.round(seconds / 3600)}h`;
                    };
                    return (
                      <tr key={user.user_id} className="hover:bg-muted/50">
                        <td className="px-4 py-3 text-sm">{user.email}</td>
                        <td className="px-4 py-3 text-sm">{user.manager_name || '-'}</td>
                        <td className="px-4 py-3">
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          {user.is_superadmin && (
                            <Badge variant="default">
                              <Shield className="h-3 w-3 mr-1" />
                              Super Admin
                            </Badge>
                          )}
                          {!user.is_superadmin && (
                            <Badge variant="outline">Utilisateur</Badge>
                          )}
                        </td>
                        <td className="hidden sm:table-cell px-4 py-3 text-sm">
                          <HoverCard>
                            <HoverCardTrigger asChild>
                              <div className="flex flex-col gap-1 cursor-pointer">
                                <span className="text-muted-foreground">
                                  {user.league_count} {user.league_count > 1 ? 'ligues' : 'ligue'}
                                </span>
                                {user.league_admin_count > 0 && (
                                  <Badge variant="outline" className="text-xs w-fit">
                                    <Shield className="h-3 w-3 mr-1" />
                                    {user.league_admin_count} admin{user.league_admin_count > 1 ? 's' : ''}
                                  </Badge>
                                )}
                              </div>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-80">
                              <div className="space-y-2">
                                <h4 className="text-sm font-semibold">Ligues administrées</h4>
                                {user.league_roles
                                  ?.filter(l => l.role === 'owner' || l.role === 'admin')
                                  .map(league => (
                                    <div key={league.league_id} className="flex items-center justify-between text-sm">
                                      <span className="truncate flex-1">{league.league_name}</span>
                                      <Badge variant={league.role === 'owner' ? 'default' : 'secondary'} className="text-xs ml-2">
                                        {league.role === 'owner' ? 'Propriétaire' : 'Admin'}
                                      </Badge>
                                    </div>
                                  ))}
                                {user.league_admin_count === 0 && (
                                  <p className="text-sm text-muted-foreground">Aucune ligue administrée</p>
                                )}
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        </td>
                        <td className="hidden sm:table-cell px-4 py-3 text-sm">
                          <HoverCard>
                            <HoverCardTrigger asChild>
                              <div className="flex flex-col gap-1 cursor-pointer">
                                <div className="flex items-center gap-1">
                                  <Eye className="h-3 w-3 text-muted-foreground" />
                                  <span>{activity?.pages_today || 0} pages auj.</span>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {activity?.sessions_last_7_days || 0} sessions / 7j
                                </span>
                              </div>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-80">
                              <div className="space-y-3">
                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                  <Activity className="h-4 w-4" />
                                  Statistiques d'activité
                                </h4>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <div className="flex items-center gap-2">
                                    <Eye className="h-3 w-3 text-muted-foreground" />
                                    <span>Pages vues total:</span>
                                  </div>
                                  <span className="font-medium">{activity?.total_page_views || 0}</span>
                                  
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-3 w-3 text-muted-foreground" />
                                    <span>Sessions total:</span>
                                  </div>
                                  <span className="font-medium">{activity?.total_sessions || 0}</span>
                                  
                                  <div className="flex items-center gap-2">
                                    <Eye className="h-3 w-3 text-muted-foreground" />
                                    <span>Pages aujourd'hui:</span>
                                  </div>
                                  <span className="font-medium">{activity?.pages_today || 0}</span>
                                  
                                  <div className="flex items-center gap-2">
                                    <Eye className="h-3 w-3 text-muted-foreground" />
                                    <span>Pages 7 derniers jours:</span>
                                  </div>
                                  <span className="font-medium">{activity?.pages_last_7_days || 0}</span>
                                  
                                  <div className="flex items-center gap-2">
                                    <Eye className="h-3 w-3 text-muted-foreground" />
                                    <span>Pages 30 derniers jours:</span>
                                  </div>
                                  <span className="font-medium">{activity?.pages_last_30_days || 0}</span>
                                  
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                    <span>Durée moy. session:</span>
                                  </div>
                                  <span className="font-medium">
                                    {formatDuration(activity?.avg_session_duration_seconds || 0)}
                                  </span>
                                </div>
                                
                                {activity?.last_page_path && (
                                  <div className="pt-2 border-t">
                                    <p className="text-xs text-muted-foreground">Dernière page visitée:</p>
                                    <p className="text-sm font-mono truncate">{activity.last_page_path}</p>
                                    {activity.last_activity_at && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {formatDistanceToNow(new Date(activity.last_activity_at), { addSuffix: true, locale: fr })}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {activity?.last_activity_at
                            ? format(new Date(activity.last_activity_at), 'dd MMM yyyy', { locale: fr })
                            : user.last_sign_in_at 
                              ? format(new Date(user.last_sign_in_at), 'dd MMM yyyy', { locale: fr })
                              : 'Jamais'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditRole(user)}
                              title="Modifier le rôle"
                            >
                              <Shield className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResetPassword(user)}
                              title="Réinitialiser le mot de passe"
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                            {!user.email_confirmed_at && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => resendConfirmationMutation.mutate(user.email)}
                                title="Renvoyer l'email de confirmation"
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleBan(user, !user.banned_until)}
                              title={user.banned_until ? "Réactiver" : "Suspendre"}
                            >
                              {user.banned_until ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <Ban className="h-4 w-4 text-red-600" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteUser(user)}
                              title="Supprimer l'utilisateur"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Role Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le rôle</DialogTitle>
            <DialogDescription>
              Changez le rôle de {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="role">Rôle</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">
                    <div className="flex flex-col items-start">
                      <span>Utilisateur</span>
                      <span className="text-xs text-muted-foreground">Accès standard</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="superadmin">
                    <div className="flex flex-col items-start">
                      <span className="flex items-center">
                        <Shield className="h-3 w-3 mr-1" />
                        Super Administrateur
                      </span>
                      <span className="text-xs text-muted-foreground">Accès complet à toutes les fonctionnalités</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedUser(null)}>
              Annuler
            </Button>
            <Button onClick={handleSaveRole} disabled={setRoleMutation.isPending}>
              {setRoleMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
            <DialogDescription>
              {!resetLink 
                ? `Envoyer un email de réinitialisation à ${resetPasswordUser?.email} ?`
                : "Email envoyé ! Vous pouvez copier le lien ci-dessous si nécessaire."}
            </DialogDescription>
          </DialogHeader>
          {resetLink && (
            <div className="py-4">
              <div className="flex items-center gap-2">
                <Input value={resetLink} readOnly className="font-mono text-xs" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(resetLink);
                    toast.success("Lien copié !");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            {!resetLink ? (
              <>
                <Button variant="outline" onClick={() => setResetPasswordDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleConfirmResetPassword} disabled={resetPasswordMutation.isPending}>
                  {resetPasswordMutation.isPending ? "Envoi..." : "Envoyer"}
                </Button>
              </>
            ) : (
              <Button onClick={() => setResetPasswordDialogOpen(false)}>
                Fermer
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ban Confirmation Dialog */}
      <AlertDialog open={banConfirmDialogOpen} onOpenChange={setBanConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {banAction ? "Suspendre l'utilisateur" : "Réactiver l'utilisateur"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {banAction 
                ? `Êtes-vous sûr de vouloir suspendre ${banTargetUser?.email} ? L'utilisateur ne pourra plus se connecter.`
                : `Êtes-vous sûr de vouloir réactiver ${banTargetUser?.email} ? L'utilisateur pourra à nouveau se connecter.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmToggleBan}
              className={banAction ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {toggleBanMutation.isPending ? "Traitement..." : "Confirmer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={deleteConfirmDialogOpen} onOpenChange={setDeleteConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'utilisateur</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer définitivement <strong>{deleteTargetUser?.email}</strong> ?
              <br /><br />
              <span className="text-destructive font-medium">
                Cette action est irréversible. Toutes les données associées à cet utilisateur seront supprimées.
              </span>
              {deleteTargetUser?.manager_name && (
                <span className="block mt-2">
                  Manager associé : {deleteTargetUser.manager_name}
                </span>
              )}
              {deleteTargetUser?.league_count && deleteTargetUser.league_count > 0 && (
                <span className="block mt-1 text-amber-600">
                  ⚠️ Cet utilisateur est membre de {deleteTargetUser.league_count} ligue(s)
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUserMutation.isPending ? "Suppression..." : "Supprimer définitivement"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
