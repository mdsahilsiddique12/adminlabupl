import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Plus, Shield, UserCog } from "lucide-react";
import { useCreateUser, useUpdateUser, useUsers } from "@/hooks/use-users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type RoleValue = "staff" | "admin" | "owner";

function normalizeRole(role: string | null | undefined): RoleValue {
  const value = (role || "staff").toLowerCase();
  if (value === "owner" || value === "admin") return value;
  return "staff";
}

export default function Users() {
  const { data: users = [], isLoading } = useUsers();
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    username: "",
    email: "",
    password: "",
    role: "staff" as RoleValue,
  });
  const [editForm, setEditForm] = useState({
    username: "",
    role: "staff" as RoleValue,
    password: "",
  });

  const editingUser = useMemo(
    () => users.find((u) => u.id === editingUserId) ?? null,
    [users, editingUserId]
  );

  const openEdit = (user: any) => {
    setEditingUserId(user.id);
    setEditForm({
      username: user.username,
      role: normalizeRole(user.role),
      password: "",
    });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(
      {
        username: createForm.username.trim(),
        email: createForm.email.trim(),
        password: createForm.password,
        role: createForm.role.toUpperCase(),
      },
      {
        onSuccess: () => {
          setIsCreateOpen(false);
          setCreateForm({ username: "", email: "", password: "", role: "staff" });
        },
      }
    );
  };

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    updateMutation.mutate(
      {
        id: editingUser.id,
        username: editForm.username.trim(),
        role: editForm.role.toUpperCase(),
        ...(editForm.password.trim() ? { password: editForm.password } : {}),
      },
      {
        onSuccess: () => {
          setEditingUserId(null);
        },
      }
    );
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">User Management</h1>
          <p className="text-muted-foreground">Create users and update username, role, and password.</p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Create User</DialogTitle>
            </DialogHeader>
            <form className="space-y-4 pt-2" onSubmit={handleCreate}>
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  value={createForm.username}
                  onChange={(e) => setCreateForm((s) => ({ ...s, username: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((s) => ({ ...s, email: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm((s) => ({ ...s, password: e.target.value }))}
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={createForm.role}
                  onValueChange={(value: RoleValue) => setCreateForm((s) => ({ ...s, role: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create User"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUserId(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <form className="space-y-4 pt-2" onSubmit={handleEditSave}>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={editForm.username}
                onChange={(e) => setEditForm((s) => ({ ...s, username: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={editForm.role}
                onValueChange={(value: RoleValue) => setEditForm((s) => ({ ...s, role: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>New Password (optional)</Label>
              <Input
                type="password"
                value={editForm.password}
                onChange={(e) => setEditForm((s) => ({ ...s, password: e.target.value }))}
                placeholder="Leave blank to keep current password"
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="bg-card rounded-2xl border border-border/40 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/20 border-b border-border/40">
              <tr>
                <th className="px-6 py-4 font-medium">User</th>
                <th className="px-6 py-4 font-medium">Role</th>
                <th className="px-6 py-4 font-medium">Joined</th>
                <th className="px-6 py-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">Loading users...</td>
                </tr>
              ) : (
                users.map((user) => {
                  const role = normalizeRole(user.role);
                  return (
                    <tr key={user.id} className="hover:bg-muted/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-foreground">{user.username}</div>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant="outline"
                          className={
                            role === "owner"
                              ? "border-primary text-primary"
                              : role === "admin"
                              ? "border-blue-500 text-blue-500"
                              : ""
                          }
                        >
                          <Shield className="w-3 h-3 mr-1" />
                          {role.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {user.createdAt ? format(new Date(user.createdAt), "MMM dd, yyyy") : "N/A"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => openEdit(user)}
                        >
                          <UserCog className="w-4 h-4" />
                          Edit
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
