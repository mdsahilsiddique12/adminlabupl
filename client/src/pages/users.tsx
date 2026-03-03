import { useState } from "react";
import { useUsers, useUpdateUser } from "@/hooks/use-users";
import { format } from "date-fns";
import { UserCog, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function Users() {
  const { data: users = [], isLoading } = useUsers();
  const updateMutation = useUpdateUser();

  const handleRoleChange = (userId: string, newRole: string) => {
    updateMutation.mutate({ id: userId, role: newRole });
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">User Management</h1>
        <p className="text-muted-foreground">Manage admin access and user roles.</p>
      </div>

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
                <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">Loading users...</td></tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="font-medium text-foreground">{user.username}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className={
                        user.role === 'owner' ? 'border-primary text-primary' : 
                        user.role === 'admin' ? 'border-blue-500 text-blue-500' : ''
                      }>
                        <Shield className="w-3 h-3 mr-1" />
                        {user.role}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {user.createdAt ? format(new Date(user.createdAt), 'MMM dd, yyyy') : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Select 
                        defaultValue={user.role} 
                        onValueChange={(val) => handleRoleChange(user.id, val)}
                        disabled={updateMutation.isPending}
                      >
                        <SelectTrigger className="w-[120px] ml-auto h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="owner">Owner</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
