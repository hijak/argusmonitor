import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { Loader2, Pencil, Plus, Users as UsersIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const defaultForm = {
  name: "",
  email: "",
  password: "",
  mobile_number: "",
  role: "member",
  timezone: "Europe/London",
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { data: users = [], isLoading } = useQuery({ queryKey: ["users"], queryFn: api.listUsers });
  const [form, setForm] = useState(defaultForm);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    mobile_number: "",
    role: "member",
    timezone: "Europe/London",
    is_active: true,
  });

  const sortedUsers = useMemo(() => [...users].sort((a: any, b: any) => a.name.localeCompare(b.name)), [users]);

  const createUserMutation = useMutation({
    mutationFn: () => api.createUser(form),
    onSuccess: () => {
      toast.success("User created");
      setForm(defaultForm);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create user"),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => api.updateUser(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
    onError: (error: Error) => toast.error(error.message || "Failed to update user"),
  });

  const editUserMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => api.updateUser(id, payload),
    onSuccess: () => {
      toast.success("User updated");
      setEditingUser(null);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update user"),
  });

  const openEdit = (user: any) => {
    setEditingUser(user);
    setEditForm({
      name: user.name || "",
      email: user.email || "",
      mobile_number: user.mobile_number || "",
      role: user.role || "member",
      timezone: user.timezone || "Europe/London",
      is_active: !!user.is_active,
    });
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Users" description="Manage users for access control and on-call scheduling">
        <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
          {users.length} user{users.length === 1 ? "" : "s"}
        </div>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_1.85fr]">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Add user</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Add people for login, on-call scheduling, and escalation routing.</p>

          <div className="mt-5 space-y-4">
            <div>
              <Label className="mb-1.5 block">Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1.5 block">Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1.5 block">Mobile number</Label>
              <Input value={form.mobile_number} onChange={(e) => setForm((f) => ({ ...f, mobile_number: e.target.value }))} placeholder="+44 7..." />
            </div>
            <div>
              <Label className="mb-1.5 block">Password</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5 block">Role</Label>
                <Select value={form.role} onValueChange={(value) => setForm((f) => ({ ...f, role: value }))}>
                  <SelectTrigger className="min-h-11 w-full">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">Timezone</Label>
                <Input value={form.timezone} onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))} />
              </div>
            </div>
            <Button
              onClick={() => createUserMutation.mutate()}
              disabled={!form.name || !form.email || form.password.length < 8 || createUserMutation.isPending}
              className="min-h-11 w-full"
            >
              {createUserMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create user
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card">
          <div className="border-b border-border p-5">
            <div className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold text-foreground">User directory</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Edit people here, then attach them to on-call teams and shifts.</p>
          </div>

          <div className="divide-y divide-border">
            {isLoading && <div className="p-6 text-sm text-muted-foreground">Loading users…</div>}
            {!isLoading && sortedUsers.map((user: any) => (
              <div key={user.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">{user.name}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{user.email}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{user.role}</span>
                    <span>{user.timezone}</span>
                    {user.mobile_number && <span>{user.mobile_number}</span>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" onClick={() => openEdit(user)}>
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                  <button
                    onClick={() => toggleActiveMutation.mutate({ id: user.id, is_active: !user.is_active })}
                    className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-medium ${user.is_active ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-border bg-background text-muted-foreground"}`}
                  >
                    {user.is_active ? "Active" : "Inactive"}
                  </button>
                </div>
              </div>
            ))}
            {!isLoading && users.length === 0 && <div className="p-6 text-sm text-muted-foreground">No users yet.</div>}
          </div>
        </section>
      </div>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>
              {editingUser ? `Update ${editingUser.name}'s profile and contact details.` : "Update user"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block">Name</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1.5 block">Email</Label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1.5 block">Mobile number</Label>
              <Input value={editForm.mobile_number} onChange={(e) => setEditForm((f) => ({ ...f, mobile_number: e.target.value }))} placeholder="+44 7..." />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5 block">Role</Label>
                <Select value={editForm.role} onValueChange={(value) => setEditForm((f) => ({ ...f, role: value }))}>
                  <SelectTrigger className="min-h-11 w-full">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">Timezone</Label>
                <Input value={editForm.timezone} onChange={(e) => setEditForm((f) => ({ ...f, timezone: e.target.value }))} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingUser(null)}>Cancel</Button>
            <Button
              onClick={() => editingUser && editUserMutation.mutate({
                id: editingUser.id,
                payload: {
                  name: editForm.name,
                  email: editForm.email,
                  mobile_number: editForm.mobile_number.trim() || null,
                  role: editForm.role,
                  timezone: editForm.timezone,
                },
              })}
              disabled={editUserMutation.isPending || !editForm.name || !editForm.email}
            >
              {editUserMutation.isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
