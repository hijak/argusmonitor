import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { Loader2, Plus, Users as UsersIcon } from "lucide-react";

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { data: users = [], isLoading } = useQuery({ queryKey: ["users"], queryFn: api.listUsers });
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "member",
    timezone: "Europe/London",
  });

  const createUserMutation = useMutation({
    mutationFn: () => api.createUser(form),
    onSuccess: () => {
      toast.success("User created");
      setForm({ name: "", email: "", password: "", role: "member", timezone: "Europe/London" });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create user"),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => api.updateUser(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
    onError: (error: Error) => toast.error(error.message || "Failed to update user"),
  });

  return (
    <div className="p-6 space-y-6">
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
          <p className="mt-1 text-sm text-muted-foreground">These users can be added to on-call teams and assigned to shifts.</p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Name</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Password</label>
              <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Role</label>
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Timezone</label>
                <input value={form.timezone} onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40" />
              </div>
            </div>
            <button
              onClick={() => createUserMutation.mutate()}
              disabled={!form.name || !form.email || form.password.length < 8 || createUserMutation.isPending}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {createUserMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create user
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card">
          <div className="border-b border-border p-5">
            <div className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold text-foreground">User directory</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Keep the human roster here, then attach them to on-call teams.</p>
          </div>

          <div className="divide-y divide-border">
            {isLoading && <div className="p-6 text-sm text-muted-foreground">Loading users…</div>}
            {!isLoading && users.map((user: any) => (
              <div key={user.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-foreground">{user.name}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{user.email}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{user.role} · {user.timezone}</div>
                </div>
                <button
                  onClick={() => toggleActiveMutation.mutate({ id: user.id, is_active: !user.is_active })}
                  className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-medium ${user.is_active ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-border bg-background text-muted-foreground"}`}
                >
                  {user.is_active ? "Active" : "Inactive"}
                </button>
              </div>
            ))}
            {!isLoading && users.length === 0 && <div className="p-6 text-sm text-muted-foreground">No users yet.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
