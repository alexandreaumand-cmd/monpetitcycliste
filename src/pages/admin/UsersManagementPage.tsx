import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Users as UsersIcon, Clock, Loader2, Edit } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

interface UserData {
  user_id: string;
  email: string;
  manager_id: string | null;
  manager_nom: string | null;
  is_superadmin: boolean;
  league_count: number;
  last_sign_in: string | null;
}

export const UsersManagementPage = () => {
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [newRole, setNewRole] = useState<'superadmin' | 'user'>('user');

  // Fetch all users with their roles
  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users-list'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-users-list');
      if (error) throw error;
      return data.users as UserData[];
    }
  });

  // Mutation to set user role
  const setRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: 'superadmin' | 'user' }) => {
      const { data, error } = await supabase.functions.invoke('admin-user-set-role', {
        body: { user_id: userId, role }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Rôle utilisateur mis à jour");
      queryClient.invalidateQueries({ queryKey: ['admin-users-list'] });
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast.error("Erreur : " + error.message);
    }
  });

  const handleEditRole = (user: UserData) => {
    setSelectedUser(user);
    setNewRole(user.is_superadmin ? 'superadmin' : 'user');
  };

  const handleSaveRole = () => {
    if (!selectedUser) return;
    setRoleMutation.mutate({
      userId: selectedUser.user_id,
      role: newRole
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Gestion des utilisateurs</h2>
        <p className="text-muted-foreground mt-1">
          Gérez les rôles, permissions et accès des utilisateurs
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Utilisateurs</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Super Admins</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users?.filter(u => u.is_superadmin).length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utilisateurs actifs</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users?.filter(u => u.last_sign_in).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des utilisateurs</CardTitle>
          <CardDescription>
            Gérez les rôles et permissions de tous les utilisateurs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Ligues</TableHead>
                <TableHead>Dernière connexion</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((user) => (
                <TableRow key={user.user_id}>
                  <TableCell className="font-mono text-sm">{user.email}</TableCell>
                  <TableCell>
                    {user.manager_nom || <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>
                    {user.is_superadmin ? (
                      <Badge variant="default" className="gap-1">
                        <Shield className="h-3 w-3" />
                        Super Admin
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Utilisateur</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{user.league_count} ligues</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.last_sign_in 
                      ? new Date(user.last_sign_in).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : <span className="text-muted-foreground">Jamais</span>
                    }
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditRole(user)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Modifier
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {users?.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Aucun utilisateur trouvé
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Role Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le rôle utilisateur</DialogTitle>
            <DialogDescription>
              Changez le rôle de <strong>{selectedUser?.email}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="role">Rôle</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as 'superadmin' | 'user')}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Utilisateur standard</SelectItem>
                  <SelectItem value="superadmin">Super Administrateur</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-muted p-3 rounded-lg text-sm">
              <p className="font-medium mb-1">Permissions :</p>
              {newRole === 'superadmin' ? (
                <ul className="text-xs space-y-1 text-muted-foreground">
                  <li>✓ Accès à l'interface super admin</li>
                  <li>✓ Gestion des résultats et startlists</li>
                  <li>✓ Import/export de données</li>
                  <li>✓ Gestion globale des ligues</li>
                  <li>✓ Gestion des utilisateurs</li>
                </ul>
              ) : (
                <ul className="text-xs space-y-1 text-muted-foreground">
                  <li>✓ Accès aux fonctionnalités standard</li>
                  <li>✓ Peut être admin de ligue</li>
                  <li>✗ Pas d'accès à l'interface super admin</li>
                </ul>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedUser(null)}>
              Annuler
            </Button>
            <Button 
              onClick={handleSaveRole}
              disabled={setRoleMutation.isPending}
            >
              {setRoleMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                'Enregistrer'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
