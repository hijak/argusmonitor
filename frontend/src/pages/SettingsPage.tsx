import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useAppMeta } from "@/contexts/AppMetaContext";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import {
  User, Bell, Shield, Plug, Palette, Globe, ChevronLeft, LogOut,
  Plus, Trash2, Send, Key, Mail, MessageSquare, Webhook, Phone,
  Check, X, Copy, Eye, EyeOff, Loader2, ChevronRight, Monitor, Bot,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type Section = null | "profile" | "notifications" | "security" | "integrations" | "appearance" | "ai" | "telemetry" | "retention" | "agents";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const item = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.15 } } };

const sections = [
  { key: "profile" as Section, label: "Profile", description: "Manage your account and preferences", icon: User },
  { key: "notifications" as Section, label: "Notifications", description: "Configure alert channels and routing", icon: Bell },
  { key: "security" as Section, label: "Security", description: "API keys and access control", icon: Shield },
  { key: "integrations" as Section, label: "Integrations", description: "Connect Slack, PagerDuty, webhooks", icon: Plug },
  { key: "appearance" as Section, label: "Appearance", description: "Theme and display preferences", icon: Palette },
  { key: "ai" as Section, label: "AI Assistant", description: "Model, response style, and assistant defaults", icon: Bot },
  { key: "telemetry" as Section, label: "Telemetry", description: "Privacy-first product telemetry controls", icon: Monitor, selfHostedOnly: true },
  { key: "retention" as Section, label: "Retention", description: "Control pruning windows for logs, metrics, alerts, and runs", icon: Shield },
  { key: "agents" as Section, label: "Agents", description: "Manage monitoring agents and endpoints", icon: Globe },
];

const integrationIcons: Record<string, string> = {
  slack: "#E01E5A", pagerduty: "#06AC38", jira: "#0052CC",
  github: "#888", webhook: "#F59E0B", teams: "#5B5FC7", opsgenie: "#2684FF",
};

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { meta } = useAppMeta();
  const [active, setActive] = useState<Section>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const section = (e as CustomEvent).detail as Section;
      if (section) setActive(section);
    };
    window.addEventListener("argus:settings-navigate", handler);
    return () => window.removeEventListener("argus:settings-navigate", handler);
  }, []);

  if (active) {
    return (
      <div className="p-6 space-y-6 max-w-3xl">
        <button onClick={() => setActive(null)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
          <ChevronLeft className="h-4 w-4" /> Back to Settings
        </button>
        {active === "profile" && <ProfileSection />}
        {active === "notifications" && <NotificationsSection />}
        {active === "security" && <SecuritySection />}
        {active === "integrations" && <IntegrationsSection />}
        {active === "appearance" && <AppearanceSection />}
        {active === "ai" && <AISettingsSection />}
        {active === "telemetry" && <TelemetrySection />}
        {active === "retention" && <RetentionSection />}
        {active === "agents" && <AgentsSection />}
      </div>
    );
  }

  return (
    <motion.div className="p-6 space-y-6 max-w-2xl" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}>
        <PageHeader title="Settings" description="Manage your Vordr configuration" />
      </motion.div>

      <motion.div variants={item} className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Runtime Mode</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {meta?.demo_mode ? "Demo mode is enabled. Seeded placeholder data is visible across the app." : "Normal mode is enabled. Only real data and anything you create will appear."}
            </p>
          </div>
          <StatusBadge variant={meta?.demo_mode ? "warning" : "healthy"}>{meta?.demo_mode ? "Demo" : "Live"}</StatusBadge>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Edition Profile</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {meta?.edition?.is_managed ? "Managed-control-plane conveniences are enabled for this deployment." : "This deployment is running without managed-control-plane conveniences."}
            </p>
          </div>
          <StatusBadge variant={meta?.edition?.is_enterprise ? "info" : "neutral"}>{meta?.edition?.label || "Self-Hosted"}</StatusBadge>
        </div>
        <div className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground space-y-1">
          <div>Toggle demo mode with <span className="font-mono">VORDR_DEMO_MODE=true</span> before starting the backend.</div>
          <div>Set the edition with <span className="font-mono">VORDR_EDITION_PROFILE=self_hosted|cloud|enterprise</span>.</div>
        </div>
      </motion.div>

      {user && (
        <motion.div variants={item} className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground capitalize">{user.role}</span>
          </div>
        </motion.div>
      )}

      <motion.div variants={item} className="rounded-lg border border-border bg-card divide-y divide-border">
        {sections
          .filter((s: any) => !s.selfHostedOnly || meta?.edition?.profile === "self_hosted")
          .map(s => (
          <button
            key={s.key}
            onClick={() => setActive(s.key)}
            className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-hover"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <s.icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{s.label}</p>
              <p className="text-xs text-muted-foreground">{s.description}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </motion.div>

      <motion.div variants={item}>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg border border-critical/30 bg-critical/5 px-5 py-3 text-sm text-critical transition-colors hover:bg-critical/10"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </motion.div>
    </motion.div>
  );
}

// ===================== PROFILE =====================
function ProfileSection() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [curPwd, setCurPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const updateMut = useMutation({
    mutationFn: () => api.updateProfile({ name, email }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });

  const pwdMut = useMutation({
    mutationFn: () => api.changePassword({ current_password: curPwd, new_password: newPwd }),
    onSuccess: () => { setPwdMsg({ ok: true, text: "Password updated" }); setCurPwd(""); setNewPwd(""); },
    onError: (e: any) => setPwdMsg({ ok: false, text: e.message }),
  });

  return (
    <motion.div className="space-y-6" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}><PageHeader title="Profile" description="Update your account details" /></motion.div>

      <motion.div variants={item} className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="text-sm font-medium">Account Information</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Full Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25" />
          </div>
        </div>
        <div className="flex justify-end">
          <button onClick={() => updateMut.mutate()} disabled={updateMut.isPending}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {updateMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save Changes
          </button>
        </div>
        {updateMut.isSuccess && <p className="text-xs text-success">Profile updated successfully.</p>}
      </motion.div>

      <motion.div variants={item} className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="text-sm font-medium">Change Password</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Current Password</label>
            <input value={curPwd} onChange={e => setCurPwd(e.target.value)} type="password"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">New Password</label>
            <input value={newPwd} onChange={e => setNewPwd(e.target.value)} type="password"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => pwdMut.mutate()} disabled={!curPwd || !newPwd || pwdMut.isPending}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {pwdMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shield className="h-3 w-3" />} Update Password
          </button>
          {pwdMsg && <p className={`text-xs ${pwdMsg.ok ? "text-success" : "text-critical"}`}>{pwdMsg.text}</p>}
        </div>
      </motion.div>

      <motion.div variants={item} className="rounded-lg border border-border bg-card p-6 space-y-2">
        <h3 className="text-sm font-medium">Account Details</h3>
        <div className="grid gap-2 text-xs text-muted-foreground">
          <div className="flex justify-between"><span>Role</span><span className="capitalize font-mono">{user?.role}</span></div>
          <div className="flex justify-between"><span>User ID</span><span className="font-mono">{user?.id?.slice(0, 8)}...</span></div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ===================== NOTIFICATIONS =====================
function NotificationsSection() {
  const qc = useQueryClient();
  const { data: channels = [], isLoading } = useQuery({ queryKey: ["notif-channels"], queryFn: api.listNotificationChannels });
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("email");
  const [newConfig, setNewConfig] = useState("");
  const [channelToDelete, setChannelToDelete] = useState<any | null>(null);

  const channelTypeIcons: Record<string, typeof Mail> = { email: Mail, slack: MessageSquare, pagerduty: Phone, webhook: Webhook, teams: MessageSquare };

  const createMut = useMutation({
    mutationFn: () => api.createNotificationChannel({ name: newName, type: newType, config: newConfig ? JSON.parse(newConfig) : {} }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notif-channels"] }); setShowAdd(false); setNewName(""); setNewConfig(""); },
  });
  const deleteMut = useMutation({ mutationFn: (id: string) => api.deleteNotificationChannel(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["notif-channels"] }) });
  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.updateNotificationChannel(id, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notif-channels"] }),
  });
  const testMut = useMutation({ mutationFn: (id: string) => api.testNotificationChannel(id) });

  return (
    <motion.div className="space-y-6" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}>
        <PageHeader title="Notifications" description="Configure where alerts are sent">
          <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Add Channel
          </button>
        </PageHeader>
      </motion.div>

      {showAdd && (
        <motion.div variants={item} className="rounded-lg border border-primary/30 bg-card p-5 space-y-4">
          <h3 className="text-sm font-medium">New Notification Channel</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Name</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Ops Team Slack"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Type</label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select channel type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="slack">Slack</SelectItem>
                  <SelectItem value="pagerduty">PagerDuty</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                  <SelectItem value="teams">Microsoft Teams</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Config (JSON, optional)</label>
            <textarea value={newConfig} onChange={e => setNewConfig(e.target.value)} rows={3} placeholder='{"recipients": ["ops@example.com"]}'
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-mono outline-none focus:border-primary/50" />
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowAdd(false)} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-surface-hover">Cancel</button>
            <button onClick={() => createMut.mutate()} disabled={!newName || createMut.isPending}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {createMut.isPending && <Loader2 className="h-3 w-3 animate-spin" />} Create
            </button>
          </div>
        </motion.div>
      )}

      <motion.div variants={item} className="rounded-lg border border-border bg-card divide-y divide-border">
        {isLoading && <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>}
        {channels.map((ch: any) => {
          const Icon = channelTypeIcons[ch.type] || Bell;
          return (
            <div key={ch.id} className="flex items-center gap-4 px-5 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{ch.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{ch.type}</p>
              </div>
              <button onClick={() => toggleMut.mutate({ id: ch.id, enabled: !ch.enabled })}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${ch.enabled ? "bg-primary" : "bg-muted"}`}>
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${ch.enabled ? "translate-x-4.5" : "translate-x-0.5"}`}
                  style={{ transform: `translateX(${ch.enabled ? "18px" : "2px"})` }} />
              </button>
              <button onClick={() => testMut.mutate(ch.id)} disabled={testMut.isPending}
                className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground">
                {testMut.isPending && testMut.variables === ch.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              </button>
              <button onClick={() => setChannelToDelete(ch)}
                className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-critical/10 hover:text-critical hover:border-critical/30">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          );
        })}
        {!isLoading && channels.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">No notification channels configured</div>
        )}
      </motion.div>

      {testMut.isSuccess && (
        <p className="text-xs text-success">Test notification sent successfully.</p>
      )}

      <AlertDialog open={!!channelToDelete} onOpenChange={(open) => !open && setChannelToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete notification channel</AlertDialogTitle>
            <AlertDialogDescription>
              {channelToDelete ? `Delete notification channel "${channelToDelete.name}"? This cannot be undone.` : "This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (channelToDelete) {
                  deleteMut.mutate(channelToDelete.id);
                  setChannelToDelete(null);
                }
              }}
            >
              {deleteMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

// ===================== SECURITY =====================
function SecuritySection() {
  const qc = useQueryClient();
  const { data: keys = [], isLoading } = useQuery({ queryKey: ["api-keys"], queryFn: api.listApiKeys });
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [keyToRevoke, setKeyToRevoke] = useState<any | null>(null);

  const createMut = useMutation({
    mutationFn: () => api.createApiKey(newKeyName),
    onSuccess: (data: any) => {
      setCreatedKey(data.key);
      setNewKeyName("");
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("API key created");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create API key"),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteApiKey(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("API key revoked");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to revoke API key"),
  });

  return (
    <motion.div className="space-y-6" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}><PageHeader title="Security" description="API keys and access management" /></motion.div>

      <motion.div variants={item} className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="text-sm font-medium">Create API Key</h3>
        <div className="flex gap-3">
          <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="Key name, e.g. CI/CD Pipeline"
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary/50" />
          <button onClick={() => createMut.mutate()} disabled={!newKeyName || createMut.isPending}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {createMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Key className="h-3 w-3" />} Generate
          </button>
        </div>
        {createdKey && (
          <div className="rounded-lg border border-success/30 bg-success/5 p-4 space-y-2">
            <p className="text-xs font-medium text-success">API key created. Copy it now -- it won't be shown again.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono break-all">
                {showKey ? createdKey : createdKey.slice(0, 12) + "..." + "*".repeat(30)}
              </code>
              <button onClick={() => setShowKey(!showKey)} className="rounded-md border border-border p-2 text-muted-foreground hover:bg-surface-hover">
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
              <button onClick={() => { navigator.clipboard.writeText(createdKey); toast.success("API key copied"); }} className="rounded-md border border-border p-2 text-muted-foreground hover:bg-surface-hover">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </motion.div>

      <motion.div variants={item} className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <h3 className="text-sm font-medium">Active API Keys</h3>
        </div>
        <div className="divide-y divide-border">
          {isLoading && <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>}
          {keys.map((k: any) => (
            <div key={k.id} className="flex items-center gap-4 px-5 py-3">
              <Key className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{k.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{k.prefix}...  ·  Created {new Date(k.created_at).toLocaleDateString()}</p>
              </div>
              <button onClick={() => setKeyToRevoke(k)}
                className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-critical/10 hover:text-critical hover:border-critical/30">
                Revoke
              </button>
            </div>
          ))}
          {!isLoading && keys.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">No API keys. Create one above.</div>
          )}
        </div>
      </motion.div>

      <AlertDialog open={!!keyToRevoke} onOpenChange={(open) => !open && setKeyToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API key</AlertDialogTitle>
            <AlertDialogDescription>
              {keyToRevoke ? `Revoke API key "${keyToRevoke.name}"? Any clients using it will stop working immediately.` : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (keyToRevoke) {
                  deleteMut.mutate(keyToRevoke.id);
                  setKeyToRevoke(null);
                }
              }}
            >
              {deleteMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

// ===================== INTEGRATIONS =====================
function IntegrationsSection() {
  const qc = useQueryClient();
  const { data: integrations = [], isLoading } = useQuery({ queryKey: ["integrations"], queryFn: api.listIntegrations });
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("webhook");
  const [newConfig, setNewConfig] = useState('{\n  "url": "https://example.com/webhook"\n}');
  const [integrationToDelete, setIntegrationToDelete] = useState<any | null>(null);

  const createMut = useMutation({
    mutationFn: async () => {
      const config = newConfig.trim() ? JSON.parse(newConfig) : {};
      return api.createIntegration({ name: newName, type: newType, config, status: "disconnected" });
    },
    onSuccess: () => {
      setNewName("");
      qc.invalidateQueries({ queryKey: ["integrations"] });
      toast.success("Integration created");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create integration"),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updateIntegration(id, { status: status === "connected" ? "disconnected" : "connected" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integrations"] });
      toast.success("Integration updated");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update integration"),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteIntegration(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integrations"] });
      toast.success("Integration deleted");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to delete integration"),
  });

  return (
    <motion.div className="space-y-6" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}><PageHeader title="Integrations" description="Connect external services" /></motion.div>

      <motion.div variants={item} className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium">Add integration</h3>
            <p className="text-xs text-muted-foreground">Create a new integration and connect it when ready.</p>
          </div>
          <button
            onClick={() => createMut.mutate()}
            disabled={!newName.trim() || createMut.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {createMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add integration
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Name</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Slack production alerts"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Type</label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select integration type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(integrationIcons).map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Config (JSON)</label>
            <textarea value={newConfig} onChange={e => setNewConfig(e.target.value)} rows={6}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-mono outline-none focus:border-primary/50" />
          </div>
        </div>
      </motion.div>

      <motion.div variants={item} className="grid gap-4 sm:grid-cols-2">
        {isLoading && <div className="col-span-full p-8 text-center text-sm text-muted-foreground">Loading...</div>}
        {integrations.map((integ: any) => (
          <div key={integ.id} className="rounded-lg border border-border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: (integrationIcons[integ.type] || "#888") + "18" }}>
                  <Plug className="h-4 w-4" style={{ color: integrationIcons[integ.type] || "#888" }} />
                </div>
                <div>
                  <p className="text-sm font-medium">{integ.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{integ.type}</p>
                </div>
              </div>
              <StatusBadge variant={integ.status === "connected" ? "healthy" : integ.status === "error" ? "critical" : "unknown"}>
                {integ.status}
              </StatusBadge>
            </div>
            {integ.config && Object.keys(integ.config).length > 0 && (
              <div className="rounded bg-muted/50 px-3 py-2 space-y-0.5">
                {Object.entries(integ.config).slice(0, 3).map(([k, v]) => (
                  <p key={k} className="text-xs text-muted-foreground">
                    <span className="font-medium">{k}:</span> {typeof v === "string" ? v : JSON.stringify(v)}
                  </p>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => toggleMut.mutate({ id: integ.id, status: integ.status })}
                disabled={toggleMut.isPending}
                className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  integ.status === "connected"
                    ? "border-critical/30 text-critical hover:bg-critical/10"
                    : "border-success/30 text-success hover:bg-success/10"
                }`}
              >
                {integ.status === "connected" ? "Disconnect" : "Connect"}
              </button>
              <button onClick={() => setIntegrationToDelete(integ)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-critical/10 hover:text-critical">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </motion.div>

      <AlertDialog open={!!integrationToDelete} onOpenChange={(open) => !open && setIntegrationToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete integration</AlertDialogTitle>
            <AlertDialogDescription>
              {integrationToDelete ? `Delete integration "${integrationToDelete.name}"?` : "This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (integrationToDelete) {
                  deleteMut.mutate(integrationToDelete.id);
                  setIntegrationToDelete(null);
                }
              }}
            >
              {deleteMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}


function AISettingsSection() {
  const qc = useQueryClient();
  const { meta } = useAppMeta();
  const { data: prefs, isLoading } = useQuery({ queryKey: ["preferences"], queryFn: api.getPreferences });
  const { data: provider, isLoading: providerLoading } = useQuery({ queryKey: ["ai-provider-settings"], queryFn: api.getAIProviderSettings });
  const [providerForm, setProviderForm] = useState({ endpoint: "", model: "", api_key: "" });

  useEffect(() => {
    if (provider) {
      setProviderForm({
        endpoint: provider.endpoint || "",
        model: provider.model || "",
        api_key: "",
      });
    }
  }, [provider]);

  const updateMut = useMutation({
    mutationFn: (data: any) => api.updatePreferences(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["preferences"] });
      toast.success("AI assistant defaults saved");
    },
    onError: (e: any) => toast.error(e.message || "Failed to update AI assistant defaults"),
  });

  const providerMut = useMutation({
    mutationFn: (data: any) => api.updateAIProviderSettings(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-provider-settings"] });
      setProviderForm((current) => ({ ...current, api_key: "" }));
      toast.success("AI provider settings saved");
    },
    onError: (e: any) => toast.error(e.message || "Failed to update AI provider settings"),
  });

  if (isLoading || providerLoading || !prefs || !provider) return <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>;

  const byokAvailable = meta?.capabilities?.["ai.byok"] ?? provider.byok_enabled;
  const providerLocked = !provider.can_edit;

  return (
    <motion.div className="space-y-6" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}><PageHeader title="AI Assistant" description="Tune how Vordr Co-pilot responds and configure the provider used for self-hosted inference" /></motion.div>

      <motion.div variants={item} className="rounded-lg border border-border bg-card p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Provider configuration</p>
            <p className="mt-1 text-xs text-muted-foreground">Set the API endpoint, model, and key Vordr should use for AI features. Self-hosted installs can point this at OpenAI-compatible providers.</p>
          </div>
          <StatusBadge variant={provider.api_key_configured ? "healthy" : "warning"}>{provider.api_key_configured ? "Configured" : "Missing key"}</StatusBadge>
        </div>

        <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground space-y-1">
          <div>Edition support: {byokAvailable ? "BYOK is enabled for this deployment." : "BYOK is currently unavailable for this deployment."}</div>
          <div>Config source: {provider.source === "workspace" ? "Saved in workspace settings" : "Inherited from backend environment variables"}.</div>
          {provider.api_key_masked ? <div>Current key: <span className="font-mono">{provider.api_key_masked}</span></div> : null}
        </div>

        <div className="grid gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">API endpoint</label>
            <Input
              value={providerForm.endpoint}
              onChange={(e) => setProviderForm((f) => ({ ...f, endpoint: e.target.value }))}
              placeholder="https://api.openai.com/v1"
              disabled={providerLocked || !byokAvailable || providerMut.isPending}
            />
            <p className="mt-1 text-xs text-muted-foreground">Use the provider base URL, including the <span className="font-mono">/v1</span> path when required.</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Model</label>
            <Input
              value={providerForm.model}
              onChange={(e) => setProviderForm((f) => ({ ...f, model: e.target.value }))}
              placeholder="gpt-4o-mini"
              disabled={providerLocked || !byokAvailable || providerMut.isPending}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">API key</label>
            <Input
              type="password"
              value={providerForm.api_key}
              onChange={(e) => setProviderForm((f) => ({ ...f, api_key: e.target.value }))}
              placeholder={provider.api_key_configured ? "Leave blank to keep current key" : "sk-..."}
              disabled={providerLocked || !byokAvailable || providerMut.isPending}
            />
            <p className="mt-1 text-xs text-muted-foreground">Leave blank to keep the current key. Use clear only if you want to remove the saved workspace key and fall back to environment config.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => providerMut.mutate({ endpoint: providerForm.endpoint, model: providerForm.model, ...(providerForm.api_key.trim() ? { api_key: providerForm.api_key } : {}) })}
            disabled={providerLocked || !byokAvailable || providerMut.isPending}
            className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {providerMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save provider settings
          </button>
          <button
            onClick={() => providerMut.mutate({ clear_api_key: true, endpoint: providerForm.endpoint, model: providerForm.model })}
            disabled={providerLocked || !byokAvailable || providerMut.isPending || !provider.api_key_configured}
            className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear saved key
          </button>
        </div>

        {providerLocked ? <p className="text-xs text-warning">Provider settings are read-only in this deployment mode.</p> : null}
      </motion.div>

      <motion.div variants={item} className="rounded-lg border border-border bg-card p-6 space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Assistant behaviour profile</label>
          <Select value={prefs.ai_model || "default"} onValueChange={(value) => updateMut.mutate({ ai_model: value })}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select profile" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default routing</SelectItem>
              <SelectItem value="fast">Fast / lighter</SelectItem>
              <SelectItem value="balanced">Balanced</SelectItem>
              <SelectItem value="deep">Deeper reasoning</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Response style</label>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { value: "concise", label: "Concise", hint: "Short operational answers" },
              { value: "balanced", label: "Balanced", hint: "Default mix of detail and speed" },
              { value: "detailed", label: "Detailed", hint: "More explanation and context" },
            ].map((style) => (
              <button
                key={style.value}
                onClick={() => updateMut.mutate({ ai_response_style: style.value })}
                className={`rounded-lg border px-4 py-3 text-left transition-colors ${prefs.ai_response_style === style.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-surface-hover"}`}
              >
                <div className="text-sm font-medium">{style.label}</div>
                <div className="mt-1 text-xs">{style.hint}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Auto-summarize incidents</p>
              <p className="text-xs text-muted-foreground">Bias the assistant toward summarising alert storms and incident context.</p>
            </div>
            <button onClick={() => updateMut.mutate({ ai_auto_summarize_incidents: !prefs.ai_auto_summarize_incidents })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${prefs.ai_auto_summarize_incidents ? "bg-primary" : "bg-muted"}`}>
              <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform" style={{ transform: `translateX(${prefs.ai_auto_summarize_incidents ? "22px" : "2px"})` }} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Include monitoring context by default</p>
              <p className="text-xs text-muted-foreground">Prefer grounding assistant replies in current alerts, hosts, and incident data.</p>
            </div>
            <button onClick={() => updateMut.mutate({ ai_include_context: !prefs.ai_include_context })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${prefs.ai_include_context ? "bg-primary" : "bg-muted"}`}>
              <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform" style={{ transform: `translateX(${prefs.ai_include_context ? "22px" : "2px"})` }} />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ===================== TELEMETRY =====================
function TelemetrySection() {
  const qc = useQueryClient();
  const { meta } = useAppMeta();
  const { data: prefs, isLoading } = useQuery({ queryKey: ["preferences"], queryFn: api.getPreferences });

  const updateMut = useMutation({
    mutationFn: (data: any) => api.updatePreferences(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["preferences"] });
      toast.success("Telemetry preference saved");
    },
    onError: (e: any) => toast.error(e.message || "Failed to update telemetry preference"),
  });

  if (isLoading || !prefs) return <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>;

  const isSelfHosted = meta?.edition?.profile === "self_hosted";

  return (
    <motion.div className="space-y-6" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}><PageHeader title="Telemetry" description="Privacy-first product telemetry controls" /></motion.div>

      {!isSelfHosted ? (
        <motion.div variants={item} className="rounded-lg border border-border bg-card p-6 space-y-2">
          <p className="text-sm font-medium">Not available in this edition</p>
          <p className="text-xs text-muted-foreground">Telemetry controls are not available in this edition.</p>
        </motion.div>
      ) : (
        <>
          <motion.div variants={item} className="rounded-lg border border-border bg-card p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Anonymous install telemetry</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Send a small startup event so free self-hosted installs can be counted as active. No auto-captured clicks, no session replay, no surprise tracking.
                </p>
              </div>
              <Switch
                checked={Boolean(prefs.telemetry_enabled ?? true)}
                disabled={updateMut.isPending}
                onCheckedChange={(checked) => updateMut.mutate({ telemetry_enabled: checked })}
              />
            </div>

            <div className="rounded-lg bg-muted/40 px-3 py-3 text-xs text-muted-foreground space-y-1">
              <div>Provider: Aptabase</div>
              <div>Host: <span className="font-mono">https://aptabase.exnet.systems</span></div>
              <div>Collection style: one explicit app-start event only</div>
              <div>Current state: {Boolean(prefs.telemetry_enabled ?? true) ? "enabled" : "disabled"}</div>
            </div>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}

// ===================== APPEARANCE =====================
function AppearanceSection() {
  const qc = useQueryClient();
  const { data: prefs, isLoading } = useQuery({ queryKey: ["preferences"], queryFn: api.getPreferences });

  const updateMut = useMutation({
    mutationFn: (data: any) => api.updatePreferences(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["preferences"] }),
  });

  if (isLoading || !prefs) return <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>;

  return (
    <motion.div className="space-y-6" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}><PageHeader title="Appearance" description="Customize your display preferences" /></motion.div>

      <motion.div variants={item} className="rounded-lg border border-border bg-card p-6 space-y-5">
        <div>
          <label className="mb-2 block text-sm font-medium">Theme</label>
          <div className="flex gap-3">
            {(["dark", "light", "system"] as const).map(t => (
              <button key={t} onClick={() => updateMut.mutate({ theme: t })}
                className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                  prefs.theme === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-surface-hover"
                }`}>
                {t === "dark" ? "Dark" : t === "light" ? "Light" : "System"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Timezone</label>
          <Select value={prefs.timezone} onValueChange={(value) => updateMut.mutate({ timezone: value })}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              {["UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Europe/Paris", "Asia/Tokyo", "Asia/Shanghai", "Australia/Sydney"].map(tz => (
                <SelectItem key={tz} value={tz}>{tz}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Date Format</label>
          <Select value={prefs.date_format} onValueChange={(value) => updateMut.mutate({ date_format: value })}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select date format" />
            </SelectTrigger>
            <SelectContent>
              {["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY", "DD.MM.YYYY"].map(fmt => (
                <SelectItem key={fmt} value={fmt}>{fmt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Compact Mode</p>
            <p className="text-xs text-muted-foreground">Reduce spacing and use smaller elements</p>
          </div>
          <button onClick={() => updateMut.mutate({ compact_mode: !prefs.compact_mode })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${prefs.compact_mode ? "bg-primary" : "bg-muted"}`}>
            <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
              style={{ transform: `translateX(${prefs.compact_mode ? "22px" : "2px"})` }} />
          </button>
        </div>
      </motion.div>

      {updateMut.isSuccess && <p className="text-xs text-success">Preferences saved.</p>}
    </motion.div>
  );
}

// ===================== RETENTION =====================
function RetentionSection() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["settings-retention"], queryFn: api.getRetentionPolicy });
  const [form, setForm] = useState({ name: "Default retention", logs_days: 30, metrics_days: 30, alert_days: 90, incident_days: 180, run_days: 30, enabled: true });

  useEffect(() => {
    if (data) {
      setForm({
        name: data.name ?? "Default retention",
        logs_days: Number(data.logs_days ?? 30),
        metrics_days: Number(data.metrics_days ?? 30),
        alert_days: Number(data.alert_days ?? 90),
        incident_days: Number(data.incident_days ?? 180),
        run_days: Number(data.run_days ?? 30),
        enabled: Boolean(data.enabled),
      });
    }
  }, [data]);

  const updateMut = useMutation({
    mutationFn: () => api.updateRetentionPolicy(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings-retention"] });
      toast.success("Retention policy updated");
    },
    onError: (e: any) => toast.error(e.message || "Failed to update retention policy"),
  });

  return (
    <motion.div className="space-y-6" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}><PageHeader title="Retention" description="Control how long Vordr keeps operational history in this workspace" /></motion.div>

      <motion.div variants={item} className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-medium">Workspace retention policy</h3>
            <p className="mt-1 text-xs text-muted-foreground">Old data is pruned by the worker. There is no cold archive tier yet, so these windows are your size-control lever.</p>
          </div>
          <button onClick={() => setForm((f) => ({ ...f, enabled: !f.enabled }))} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.enabled ? "bg-primary" : "bg-muted"}`}>
            <span className="inline-block h-4 w-4 rounded-full bg-white transition-transform" style={{ transform: `translateX(${form.enabled ? "22px" : "2px"})` }} />
          </button>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading retention policy…</div>
        ) : (
          <>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Policy name</label>
              <input value={form.name} onChange={e => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField label="Logs days" value={form.logs_days} onChange={(value) => setForm((f) => ({ ...f, logs_days: value }))} />
              <NumberField label="Metrics days" value={form.metrics_days} onChange={(value) => setForm((f) => ({ ...f, metrics_days: value }))} />
              <NumberField label="Alert days" value={form.alert_days} onChange={(value) => setForm((f) => ({ ...f, alert_days: value }))} />
              <NumberField label="Incident days" value={form.incident_days} onChange={(value) => setForm((f) => ({ ...f, incident_days: value }))} />
              <NumberField label="Run days" value={form.run_days} onChange={(value) => setForm((f) => ({ ...f, run_days: value }))} />
            </div>

            <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Current default: logs 30d, metrics 30d, alerts 90d, incidents 180d, runs 30d.
            </div>

            <div className="flex justify-end">
              <button onClick={() => updateMut.mutate()} disabled={updateMut.isPending || !form.name.trim()}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {updateMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save Retention Policy
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      <input type="number" min={1} value={value} onChange={e => onChange(Number(e.target.value) || 1)}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25" />
    </div>
  );
}

// ===================== AGENTS =====================
function AgentsSection() {
  const { data: agents = [], isLoading } = useQuery({ queryKey: ["agents"], queryFn: api.listAgents });
  const { data: installInfo, isLoading: installLoading } = useQuery({ queryKey: ["agent-install"], queryFn: api.getAgentInstallInfo });

  const timeAgo = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <motion.div className="space-y-6" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}><PageHeader title="Agents" description="Monitoring agents deployed across your infrastructure" /></motion.div>

      <motion.div variants={item} className="rounded-lg border border-border bg-card p-6 space-y-3">
        <h3 className="text-sm font-medium">Install Agent</h3>
        <p className="text-xs text-muted-foreground">Run this command on any host to install the Vordr agent:</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded bg-muted px-3 py-2.5 text-xs font-mono text-muted-foreground overflow-x-auto">
            {installLoading ? "Loading install command..." : installInfo?.command || "Unable to load install command"}
          </code>
          <button
            onClick={() => {
              if (installInfo?.command) {
                navigator.clipboard.writeText(installInfo.command);
                toast.success("Install command copied");
              }
            }}
            className="rounded-md border border-border p-2 text-muted-foreground hover:bg-surface-hover shrink-0"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
        {installInfo?.notes?.length ? (
          <div className="rounded-lg bg-muted/40 px-3 py-3 text-xs text-muted-foreground space-y-1">
            {installInfo.notes.map((note: string, idx: number) => <p key={idx}>• {note}</p>)}
          </div>
        ) : null}
      </motion.div>

      <motion.div variants={item} className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-3 flex items-center justify-between">
          <h3 className="text-sm font-medium">Registered Agents</h3>
          <span className="text-xs text-muted-foreground">{agents.length} agents</span>
        </div>
        <div className="divide-y divide-border">
          {isLoading && <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>}
          {agents.map((agent: any) => (
            <div key={agent.id} className="flex items-center gap-4 px-5 py-3">
              <Monitor className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono font-medium">{agent.name}</p>
                  <StatusBadge variant={agent.status === "healthy" ? "healthy" : agent.status === "warning" ? "warning" : agent.status === "critical" ? "critical" : "unknown"}>
                    {agent.status}
                  </StatusBadge>
                </div>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{agent.ip_address || "N/A"}</span>
                  <span>·</span>
                  <span>{agent.os || "N/A"}</span>
                  <span>·</span>
                  <span>v{agent.agent_version}</span>
                </div>
              </div>
              <span className="whitespace-nowrap text-xs text-muted-foreground">Last seen: {timeAgo(agent.last_seen)}</span>
            </div>
          ))}
          {!isLoading && agents.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">No agents registered yet. Install one using the command above.</div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
