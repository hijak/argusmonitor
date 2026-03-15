import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import {
  User, Bell, Shield, Plug, Palette, Globe, ChevronLeft, LogOut,
  Plus, Trash2, Send, Key, Mail, MessageSquare, Webhook, Phone,
  Check, X, Copy, Eye, EyeOff, Loader2, ChevronRight, Monitor,
} from "lucide-react";
import { motion } from "framer-motion";

type Section = null | "profile" | "notifications" | "security" | "integrations" | "appearance" | "agents";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const item = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.15 } } };

const sections = [
  { key: "profile" as Section, label: "Profile", description: "Manage your account and preferences", icon: User },
  { key: "notifications" as Section, label: "Notifications", description: "Configure alert channels and routing", icon: Bell },
  { key: "security" as Section, label: "Security", description: "API keys and access control", icon: Shield },
  { key: "integrations" as Section, label: "Integrations", description: "Connect Slack, PagerDuty, webhooks", icon: Plug },
  { key: "appearance" as Section, label: "Appearance", description: "Theme and display preferences", icon: Palette },
  { key: "agents" as Section, label: "Agents", description: "Manage monitoring agents and endpoints", icon: Globe },
];

const integrationIcons: Record<string, string> = {
  slack: "#E01E5A", pagerduty: "#06AC38", jira: "#0052CC",
  github: "#888", webhook: "#F59E0B", teams: "#5B5FC7", opsgenie: "#2684FF",
};

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [active, setActive] = useState<Section>(null);

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
        {active === "agents" && <AgentsSection />}
      </div>
    );
  }

  return (
    <motion.div className="p-6 space-y-6 max-w-2xl" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}>
        <PageHeader title="Settings" description="Manage your ArgusMonitor configuration" />
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
        {sections.map(s => (
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
              <select value={newType} onChange={e => setNewType(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none">
                <option value="email">Email</option>
                <option value="slack">Slack</option>
                <option value="pagerduty">PagerDuty</option>
                <option value="webhook">Webhook</option>
                <option value="teams">Microsoft Teams</option>
              </select>
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
              <button onClick={() => { if (confirm("Delete this channel?")) deleteMut.mutate(ch.id); }}
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

  const createMut = useMutation({
    mutationFn: () => api.createApiKey(newKeyName),
    onSuccess: (data: any) => { setCreatedKey(data.key); setNewKeyName(""); qc.invalidateQueries({ queryKey: ["api-keys"] }); },
  });
  const deleteMut = useMutation({ mutationFn: (id: string) => api.deleteApiKey(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }) });

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
              <button onClick={() => { navigator.clipboard.writeText(createdKey); }} className="rounded-md border border-border p-2 text-muted-foreground hover:bg-surface-hover">
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
              <button onClick={() => { if (confirm("Revoke this API key?")) deleteMut.mutate(k.id); }}
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
    </motion.div>
  );
}

// ===================== INTEGRATIONS =====================
function IntegrationsSection() {
  const qc = useQueryClient();
  const { data: integrations = [], isLoading } = useQuery({ queryKey: ["integrations"], queryFn: api.listIntegrations });

  const toggleMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updateIntegration(id, { status: status === "connected" ? "disconnected" : "connected" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations"] }),
  });
  const deleteMut = useMutation({ mutationFn: (id: string) => api.deleteIntegration(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations"] }) });

  return (
    <motion.div className="space-y-6" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}><PageHeader title="Integrations" description="Connect external services" /></motion.div>

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
              <button onClick={() => { if (confirm("Remove this integration?")) deleteMut.mutate(integ.id); }}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-critical/10 hover:text-critical">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </motion.div>
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
          <select value={prefs.timezone} onChange={e => updateMut.mutate({ timezone: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none">
            {["UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Europe/Paris", "Asia/Tokyo", "Asia/Shanghai", "Australia/Sydney"].map(tz => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Date Format</label>
          <select value={prefs.date_format} onChange={e => updateMut.mutate({ date_format: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none">
            {["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY", "DD.MM.YYYY"].map(fmt => (
              <option key={fmt} value={fmt}>{fmt}</option>
            ))}
          </select>
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

// ===================== AGENTS =====================
function AgentsSection() {
  const { data: agents = [], isLoading } = useQuery({ queryKey: ["agents"], queryFn: api.listAgents });

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
        <p className="text-xs text-muted-foreground">Run this command on any host to install the ArgusMonitor agent:</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded bg-muted px-3 py-2.5 text-xs font-mono text-muted-foreground overflow-x-auto">
            curl -fsSL https://get.argusmonitor.io/agent | sudo bash -s -- --token YOUR_AGENT_TOKEN
          </code>
          <button onClick={() => navigator.clipboard.writeText("curl -fsSL https://get.argusmonitor.io/agent | sudo bash -s -- --token YOUR_AGENT_TOKEN")}
            className="rounded-md border border-border p-2 text-muted-foreground hover:bg-surface-hover shrink-0">
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
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
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span>{agent.ip_address || "N/A"}</span>
                  <span>·</span>
                  <span>{agent.os || "N/A"}</span>
                  <span>·</span>
                  <span>v{agent.agent_version}</span>
                </div>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">Last seen: {timeAgo(agent.last_seen)}</span>
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
