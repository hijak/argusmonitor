import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { api } from "@/lib/api";
import { getWorkspaceId, setWorkspaceId } from "@/lib/workspace";
import { toast } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select as UiSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Building2,
  Users,
  KeyRound,
  ShieldEllipsis,
  ScrollText,
  CalendarClock,
  VolumeX,
  TimerReset,
  Siren,
  FileSpreadsheet,
  LifeBuoy,
  Megaphone,
  Waypoints,
  Send,
} from "lucide-react";

function Section({ title, icon: Icon, children, className = "" }: { title: string; icon: any; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-border bg-card p-5 space-y-4 ${className}`}>
      <div className="flex items-center gap-2 text-foreground font-semibold">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      {children}
    </section>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
      {hint ? <div className="mt-1 text-sm text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm ${props.className || ""}`} />;
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`min-h-[100px] w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm ${props.className || ""}`} />;
}

function Select({
  value,
  onChange,
  children,
  className = "",
}: {
  value?: string;
  onChange?: (e: { target: { value: string } }) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const items = React.Children.toArray(children)
    .filter(React.isValidElement)
    .map((child: any) => ({
      value: child.props.value,
      label: child.props.children,
    }));

  const placeholderItem = items.find((item) => item.value === "");
  const selectableItems = items.filter((item) => item.value !== "");

  return (
    <UiSelect value={value || undefined} onValueChange={(next) => onChange?.({ target: { value: next } })}>
      <SelectTrigger className={`w-full ${className}`.trim()}>
        <SelectValue placeholder={typeof placeholderItem?.label === "string" ? placeholderItem.label : "Select option"} />
      </SelectTrigger>
      <SelectContent>
        {selectableItems.map((item) => (
          <SelectItem key={item.value || String(item.label)} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </UiSelect>
  );
}

function Button({ className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 ${className}`} />;
}

export default function EnterprisePage() {
  const qc = useQueryClient();

  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(getWorkspaceId() || "");

  const [orgForm, setOrgForm] = useState({ name: "", slug: "" });
  const [workspaceForm, setWorkspaceForm] = useState({ organization_id: "", name: "", slug: "", timezone: "Europe/London" });
  const [memberForm, setMemberForm] = useState({ user_id: "", role: "member" });
  const [maintenanceForm, setMaintenanceForm] = useState({ name: "", reason: "", starts_at: "", ends_at: "", scope_type: "all" });
  const [silenceForm, setSilenceForm] = useState({ name: "", reason: "", starts_at: "", ends_at: "", matcher: '{"severity":"info"}' });
  const [oidcForm, setOidcForm] = useState({ name: "OIDC", issuer: "", client_id: "", client_secret: "", authorize_url: "", token_url: "", userinfo_url: "" });
  const [samlForm, setSamlForm] = useState({ name: "SAML", entry_point: "", x509_cert: "", auto_provision: true, default_role: "member" });
  const [scimTokenForm, setScimTokenForm] = useState({ name: "Default SCIM token" });
  const [scimMappingForm, setScimMappingForm] = useState({ external_group_id: "", external_group_name: "", role: "member" });
  const [retentionForm, setRetentionForm] = useState({ name: "Default retention", logs_days: 30, metrics_days: 30, alert_days: 90, incident_days: 180, run_days: 30 });
  const [escalationForm, setEscalationForm] = useState({ name: "Default escalation", steps: '[{"delay_minutes":0,"channel":"slack"},{"delay_minutes":15,"channel":"email"}]' });
  const [complianceForm, setComplianceForm] = useState({ report_type: "soc2-summary", period_start: "", period_end: "" });
  const [exportForm, setExportForm] = useState({ export_type: "audit-log", format: "json" });
  const [supportForm, setSupportForm] = useState({ subject: "", description: "", priority: "normal" });
  const [announcementForm, setAnnouncementForm] = useState({ title: "", message: "", severity: "info", starts_at: "", ends_at: "" });
  const [notificationForm, setNotificationForm] = useState({ channel_id: "", subject: "Vordr enterprise test", text: "Enterprise notification test" });

  const { data: organizations = [] } = useQuery({ queryKey: ["enterprise-orgs"], queryFn: api.listOrganizations });
  const { data: workspaces = [] } = useQuery({
    queryKey: ["enterprise-workspaces", selectedOrgId],
    queryFn: () => api.listWorkspaces(selectedOrgId || undefined),
    enabled: organizations.length > 0,
  });
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: api.listUsers });
  const { data: workspaceMembers = [] } = useQuery({
    queryKey: ["enterprise-workspace-members", selectedWorkspaceId],
    queryFn: () => api.listWorkspaceMembers(selectedWorkspaceId),
    enabled: !!selectedWorkspaceId,
  });
  const { data: auditLogs = [] } = useQuery({ queryKey: ["enterprise-audit", selectedWorkspaceId], queryFn: () => api.listAuditLogs(selectedWorkspaceId, 50), enabled: !!selectedWorkspaceId });
  const { data: maintenanceWindows = [] } = useQuery({ queryKey: ["enterprise-maintenance", selectedWorkspaceId], queryFn: () => api.listMaintenanceWindows(selectedWorkspaceId), enabled: !!selectedWorkspaceId });
  const { data: silences = [] } = useQuery({ queryKey: ["enterprise-silences", selectedWorkspaceId], queryFn: () => api.listSilences(selectedWorkspaceId), enabled: !!selectedWorkspaceId });
  const { data: oidcProviders = [] } = useQuery({ queryKey: ["enterprise-oidc", selectedWorkspaceId], queryFn: () => api.listOidcProviders(selectedWorkspaceId), enabled: !!selectedWorkspaceId });
  const { data: retentionPolicies = [] } = useQuery({ queryKey: ["enterprise-retention", selectedWorkspaceId], queryFn: () => api.listRetentionPolicies(selectedWorkspaceId), enabled: !!selectedWorkspaceId });
  const { data: escalationPolicies = [] } = useQuery({ queryKey: ["enterprise-escalation", selectedWorkspaceId], queryFn: () => api.listEscalationPolicies(selectedWorkspaceId), enabled: !!selectedWorkspaceId });
  const { data: samlProviders = [] } = useQuery({ queryKey: ["enterprise-saml", selectedWorkspaceId], queryFn: () => api.listSamlProviders(selectedWorkspaceId), enabled: !!selectedWorkspaceId });
  const { data: scimTokens = [] } = useQuery({ queryKey: ["enterprise-scim-tokens", selectedWorkspaceId], queryFn: () => api.listScimTokens(selectedWorkspaceId), enabled: !!selectedWorkspaceId });
  const { data: scimMappings = [] } = useQuery({ queryKey: ["enterprise-scim-mappings", selectedWorkspaceId], queryFn: () => api.listScimGroupMappings(selectedWorkspaceId), enabled: !!selectedWorkspaceId });
  const { data: complianceReports = [] } = useQuery({ queryKey: ["enterprise-compliance", selectedWorkspaceId], queryFn: () => api.listComplianceReports(selectedWorkspaceId), enabled: !!selectedWorkspaceId });
  const { data: exports = [] } = useQuery({ queryKey: ["enterprise-exports", selectedWorkspaceId], queryFn: () => api.listExports(selectedWorkspaceId), enabled: !!selectedWorkspaceId });
  const { data: supportTickets = [] } = useQuery({ queryKey: ["enterprise-support", selectedWorkspaceId], queryFn: () => api.listSupportTickets(selectedWorkspaceId), enabled: !!selectedWorkspaceId });
  const { data: announcements = [] } = useQuery({ queryKey: ["enterprise-announcements"], queryFn: api.listAnnouncements });
  const { data: apiVersions = [] } = useQuery({ queryKey: ["enterprise-api-versions"], queryFn: api.listApiVersions });
  const { data: notificationChannels = [] } = useQuery({ queryKey: ["notif-channels"], queryFn: api.listNotificationChannels });

  useEffect(() => {
    if (!selectedOrgId && organizations[0]?.id) {
      setSelectedOrgId(organizations[0].id);
      setWorkspaceForm((f) => ({ ...f, organization_id: organizations[0].id }));
    }
  }, [organizations, selectedOrgId]);

  useEffect(() => {
    if (!selectedWorkspaceId && workspaces[0]?.id) {
      setSelectedWorkspaceId(workspaces[0].id);
      setWorkspaceId(workspaces[0].id);
    }
  }, [workspaces, selectedWorkspaceId]);

  useEffect(() => {
    if (selectedWorkspaceId) setWorkspaceId(selectedWorkspaceId);
  }, [selectedWorkspaceId]);

  useEffect(() => {
    if (!notificationForm.channel_id && notificationChannels[0]?.id) {
      setNotificationForm((f) => ({ ...f, channel_id: notificationChannels[0].id }));
    }
  }, [notificationChannels, notificationForm.channel_id]);

  const selectedWorkspace = useMemo(() => workspaces.find((w: any) => w.id === selectedWorkspaceId), [workspaces, selectedWorkspaceId]);
  const selectedOrganization = useMemo(() => organizations.find((o: any) => o.id === selectedOrgId), [organizations, selectedOrgId]);
  const availableUsers = useMemo(() => users.filter((u: any) => !workspaceMembers.some((m: any) => m.user_id === u.id)), [users, workspaceMembers]);

  const createOrg = useMutation({
    mutationFn: () => api.createOrganization(orgForm),
    onSuccess: () => {
      toast.success("Organization created");
      qc.invalidateQueries({ queryKey: ["enterprise-orgs"] });
      setOrgForm({ name: "", slug: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createWorkspace = useMutation({
    mutationFn: () => api.createWorkspace({ ...workspaceForm, organization_id: selectedOrgId || workspaceForm.organization_id }),
    onSuccess: (workspace: any) => {
      toast.success("Workspace created");
      setSelectedWorkspaceId(workspace.id);
      setWorkspaceId(workspace.id);
      qc.invalidateQueries({ queryKey: ["enterprise-workspaces"] });
      setWorkspaceForm({ organization_id: selectedOrgId, name: "", slug: "", timezone: "Europe/London" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addWorkspaceMember = useMutation({
    mutationFn: () => api.addWorkspaceMember(selectedWorkspaceId, memberForm),
    onSuccess: () => {
      toast.success("Workspace member added");
      qc.invalidateQueries({ queryKey: ["enterprise-workspace-members", selectedWorkspaceId] });
      setMemberForm({ user_id: "", role: "member" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createMaintenance = useMutation({
    mutationFn: () => api.createMaintenanceWindow({ ...maintenanceForm, workspace_id: selectedWorkspaceId, scope: {} }),
    onSuccess: () => {
      toast.success("Maintenance window created");
      qc.invalidateQueries({ queryKey: ["enterprise-maintenance", selectedWorkspaceId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createSilence = useMutation({
    mutationFn: () => api.createSilence({ ...silenceForm, workspace_id: selectedWorkspaceId, matcher: JSON.parse(silenceForm.matcher) }),
    onSuccess: () => {
      toast.success("Silence created");
      qc.invalidateQueries({ queryKey: ["enterprise-silences", selectedWorkspaceId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createOidc = useMutation({
    mutationFn: () => api.createOidcProvider({ ...oidcForm, workspace_id: selectedWorkspaceId, scopes: ["openid", "profile", "email"], enabled: true }),
    onSuccess: () => {
      toast.success("OIDC provider saved");
      qc.invalidateQueries({ queryKey: ["enterprise-oidc", selectedWorkspaceId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createRetention = useMutation({
    mutationFn: () => api.createRetentionPolicy({ ...retentionForm, workspace_id: selectedWorkspaceId, enabled: true }),
    onSuccess: () => {
      toast.success("Retention policy saved");
      qc.invalidateQueries({ queryKey: ["enterprise-retention", selectedWorkspaceId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createEscalation = useMutation({
    mutationFn: () => api.createEscalationPolicy({ workspace_id: selectedWorkspaceId, name: escalationForm.name, target_type: "all", steps: JSON.parse(escalationForm.steps), enabled: true }),
    onSuccess: () => {
      toast.success("Escalation policy saved");
      qc.invalidateQueries({ queryKey: ["enterprise-escalation", selectedWorkspaceId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createSaml = useMutation({
    mutationFn: () => api.createSamlProvider({ ...samlForm, workspace_id: selectedWorkspaceId, enabled: true }),
    onSuccess: () => {
      toast.success("SAML provider saved");
      qc.invalidateQueries({ queryKey: ["enterprise-saml", selectedWorkspaceId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createScimToken = useMutation({
    mutationFn: () => api.createScimToken({ ...scimTokenForm, workspace_id: selectedWorkspaceId }),
    onSuccess: () => {
      toast.success("SCIM token created");
      qc.invalidateQueries({ queryKey: ["enterprise-scim-tokens", selectedWorkspaceId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createScimMapping = useMutation({
    mutationFn: () => api.createScimGroupMapping({ ...scimMappingForm, workspace_id: selectedWorkspaceId }),
    onSuccess: () => {
      toast.success("SCIM mapping saved");
      qc.invalidateQueries({ queryKey: ["enterprise-scim-mappings", selectedWorkspaceId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createComplianceReport = useMutation({
    mutationFn: () => api.createComplianceReport({ ...complianceForm, workspace_id: selectedWorkspaceId }),
    onSuccess: () => {
      toast.success("Compliance report generated");
      qc.invalidateQueries({ queryKey: ["enterprise-compliance", selectedWorkspaceId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createExport = useMutation({
    mutationFn: () => api.createExport({ ...exportForm, workspace_id: selectedWorkspaceId, filters: {} }),
    onSuccess: () => {
      toast.success("Export created");
      qc.invalidateQueries({ queryKey: ["enterprise-exports", selectedWorkspaceId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createSupportTicket = useMutation({
    mutationFn: () => api.createSupportTicket({ ...supportForm, workspace_id: selectedWorkspaceId }),
    onSuccess: () => {
      toast.success("Support ticket created");
      qc.invalidateQueries({ queryKey: ["enterprise-support", selectedWorkspaceId] });
      setSupportForm({ subject: "", description: "", priority: "normal" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateSupportTicket = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.updateSupportTicket(id, { status }),
    onSuccess: () => {
      toast.success("Support ticket updated");
      qc.invalidateQueries({ queryKey: ["enterprise-support", selectedWorkspaceId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createAnnouncement = useMutation({
    mutationFn: () => api.createAnnouncement(announcementForm),
    onSuccess: () => {
      toast.success("Announcement created");
      qc.invalidateQueries({ queryKey: ["enterprise-announcements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deliverNotification = useMutation({
    mutationFn: () => api.deliverEnterpriseNotification(notificationForm.channel_id, { subject: notificationForm.subject, text: notificationForm.text, message: notificationForm.text }),
    onSuccess: () => toast.success("Notification delivered"),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Enterprise"
        description="Tabbed enterprise admin for orgs, access, identity, policy, and operations without the giant wall of forms."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Organizations" value={organizations.length} hint={selectedOrganization ? `Selected: ${selectedOrganization.name}` : "No organization selected"} />
        <StatCard label="Workspaces" value={workspaces.length} hint={selectedWorkspace ? `Active: ${selectedWorkspace.name}` : "Choose a workspace to scope actions"} />
        <StatCard label="Members" value={workspaceMembers.length} hint={selectedWorkspaceId ? "Loaded for active workspace" : "Select a workspace first"} />
        <StatCard label="Audit Events" value={auditLogs.length} hint={selectedWorkspaceId ? "Latest 50 events" : "No workspace context yet"} />
      </div>

      <Section title="Current Scope" icon={Building2}>
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1.2fr_0.8fr]">
          <Select
            value={selectedOrgId}
            onChange={(e) => {
              setSelectedOrgId(e.target.value);
              setWorkspaceForm((f) => ({ ...f, organization_id: e.target.value }));
            }}
          >
            <option value="">Select organization</option>
            {organizations.map((o: any) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
          <Select value={selectedWorkspaceId} onChange={(e) => setSelectedWorkspaceId(e.target.value)}>
            <option value="">Select active workspace</option>
            {workspaces.map((w: any) => (
              <option key={w.id} value={w.id}>
                {w.name} · {w.slug}
              </option>
            ))}
          </Select>
          <div className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-muted-foreground">
            {selectedWorkspace ? `${selectedWorkspace.name} · ${selectedWorkspace.slug}` : "No active workspace"}
          </div>
        </div>
      </Section>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-xl bg-muted/70 p-2 lg:grid-cols-5">
          <TabsTrigger value="overview">Overview & Access</TabsTrigger>
          <TabsTrigger value="identity">Identity & Provisioning</TabsTrigger>
          <TabsTrigger value="policy">Policy & Lifecycle</TabsTrigger>
          <TabsTrigger value="operations">Operations & Audit</TabsTrigger>
          <TabsTrigger value="support">Support & Comms</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <Section title="Organization Setup" icon={Building2}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">Create a new organization.</div>
                  <Input placeholder="Organization name" value={orgForm.name} onChange={(e) => setOrgForm((f) => ({ ...f, name: e.target.value }))} />
                  <Input placeholder="org-slug" value={orgForm.slug} onChange={(e) => setOrgForm((f) => ({ ...f, slug: e.target.value }))} />
                  <Button onClick={() => createOrg.mutate()}>Create organization</Button>
                </div>
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">Create a workspace under the selected organization.</div>
                  <Input placeholder="Workspace name" value={workspaceForm.name} onChange={(e) => setWorkspaceForm((f) => ({ ...f, name: e.target.value }))} />
                  <Input placeholder="workspace-slug" value={workspaceForm.slug} onChange={(e) => setWorkspaceForm((f) => ({ ...f, slug: e.target.value }))} />
                  <Input placeholder="Timezone" value={workspaceForm.timezone} onChange={(e) => setWorkspaceForm((f) => ({ ...f, timezone: e.target.value }))} />
                  <Button onClick={() => createWorkspace.mutate()} disabled={!(selectedOrgId || workspaceForm.organization_id)}>
                    Create workspace
                  </Button>
                </div>
              </div>
            </Section>

            <Section title="Workspace Members" icon={Users}>
              <div className="grid gap-3 md:grid-cols-[1fr_160px_auto]">
                <Select value={memberForm.user_id} onChange={(e) => setMemberForm((f) => ({ ...f, user_id: e.target.value }))}>
                  <option value="">Select user</option>
                  {availableUsers.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.name} · {u.email}
                    </option>
                  ))}
                </Select>
                <Select value={memberForm.role} onChange={(e) => setMemberForm((f) => ({ ...f, role: e.target.value }))}>
                  <option value="viewer">viewer</option>
                  <option value="member">member</option>
                  <option value="admin">admin</option>
                  <option value="owner">owner</option>
                </Select>
                <Button disabled={!selectedWorkspaceId || !memberForm.user_id} onClick={() => addWorkspaceMember.mutate()}>
                  Add member
                </Button>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                {workspaceMembers.map((m: any) => {
                  const user = users.find((u: any) => u.id === m.user_id);
                  return (
                    <div key={m.id} className="rounded-lg border border-border bg-background px-3 py-2 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-foreground">{user?.name || m.user_id}</div>
                        <div>{user?.email || "Unknown user"}</div>
                      </div>
                      <div className="rounded bg-muted px-2 py-1 text-xs uppercase tracking-wide">{m.role}</div>
                    </div>
                  );
                })}
                {!workspaceMembers.length && <div>No members loaded for this workspace.</div>}
              </div>
            </Section>
          </div>
        </TabsContent>

        <TabsContent value="identity" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <Section title="OIDC Provider" icon={KeyRound}>
              <div className="grid gap-3 md:grid-cols-2">
                <Input placeholder="Provider name" value={oidcForm.name} onChange={(e) => setOidcForm((f) => ({ ...f, name: e.target.value }))} />
                <Input placeholder="Issuer" value={oidcForm.issuer} onChange={(e) => setOidcForm((f) => ({ ...f, issuer: e.target.value }))} />
                <Input placeholder="Client ID" value={oidcForm.client_id} onChange={(e) => setOidcForm((f) => ({ ...f, client_id: e.target.value }))} />
                <Input placeholder="Client Secret" value={oidcForm.client_secret} onChange={(e) => setOidcForm((f) => ({ ...f, client_secret: e.target.value }))} />
                <Input placeholder="Authorize URL" value={oidcForm.authorize_url} onChange={(e) => setOidcForm((f) => ({ ...f, authorize_url: e.target.value }))} />
                <Input placeholder="Token URL" value={oidcForm.token_url} onChange={(e) => setOidcForm((f) => ({ ...f, token_url: e.target.value }))} />
              </div>
              <Button disabled={!selectedWorkspaceId} onClick={() => createOidc.mutate()}>
                Save OIDC provider
              </Button>
              <div className="space-y-2 text-sm text-muted-foreground">
                {oidcProviders.map((p: any) => (
                  <div key={p.id} className="rounded-lg border border-border bg-background px-3 py-2">
                    {p.name} · {p.issuer}
                  </div>
                ))}
                {!oidcProviders.length && <div>No OIDC providers configured.</div>}
              </div>
            </Section>

            <Section title="SAML & SCIM" icon={ShieldEllipsis}>
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">SAML provider</div>
                  <Input placeholder="SAML provider name" value={samlForm.name} onChange={(e) => setSamlForm((f) => ({ ...f, name: e.target.value }))} />
                  <Input placeholder="Entry point" value={samlForm.entry_point} onChange={(e) => setSamlForm((f) => ({ ...f, entry_point: e.target.value }))} />
                  <Textarea placeholder="X509 cert" value={samlForm.x509_cert} onChange={(e) => setSamlForm((f) => ({ ...f, x509_cert: e.target.value }))} className="min-h-[80px]" />
                  <Button disabled={!selectedWorkspaceId} onClick={() => createSaml.mutate()}>
                    Save SAML provider
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Input placeholder="SCIM token name" value={scimTokenForm.name} onChange={(e) => setScimTokenForm({ name: e.target.value })} />
                  <Button disabled={!selectedWorkspaceId} onClick={() => createScimToken.mutate()}>
                    Create SCIM token
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <Input placeholder="External group ID" value={scimMappingForm.external_group_id} onChange={(e) => setScimMappingForm((f) => ({ ...f, external_group_id: e.target.value }))} />
                  <Input placeholder="External group name" value={scimMappingForm.external_group_name} onChange={(e) => setScimMappingForm((f) => ({ ...f, external_group_name: e.target.value }))} />
                  <Select value={scimMappingForm.role} onChange={(e) => setScimMappingForm((f) => ({ ...f, role: e.target.value }))}>
                    <option value="viewer">viewer</option>
                    <option value="member">member</option>
                    <option value="admin">admin</option>
                    <option value="owner">owner</option>
                  </Select>
                </div>
                <Button disabled={!selectedWorkspaceId} onClick={() => createScimMapping.mutate()}>
                  Save SCIM mapping
                </Button>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {samlProviders.map((p: any) => (
                    <div key={p.id} className="rounded-lg border border-border bg-background px-3 py-2">
                      SAML · {p.name}
                    </div>
                  ))}
                  {scimTokens.map((t: any) => (
                    <div key={t.id} className="rounded-lg border border-border bg-background px-3 py-2">
                      SCIM token · {t.name}
                    </div>
                  ))}
                  {scimMappings.map((m: any) => (
                    <div key={m.id} className="rounded-lg border border-border bg-background px-3 py-2">
                      {m.external_group_name} → {m.role}
                    </div>
                  ))}
                  {!samlProviders.length && !scimTokens.length && !scimMappings.length && <div>No identity providers or mappings configured.</div>}
                </div>
              </div>
            </Section>
          </div>
        </TabsContent>

        <TabsContent value="policy" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <Section title="Retention Policies" icon={TimerReset}>
              <Input placeholder="Policy name" value={retentionForm.name} onChange={(e) => setRetentionForm((f) => ({ ...f, name: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <Input type="number" placeholder="Logs days" value={retentionForm.logs_days} onChange={(e) => setRetentionForm((f) => ({ ...f, logs_days: Number(e.target.value) }))} />
                <Input type="number" placeholder="Metrics days" value={retentionForm.metrics_days} onChange={(e) => setRetentionForm((f) => ({ ...f, metrics_days: Number(e.target.value) }))} />
                <Input type="number" placeholder="Alert days" value={retentionForm.alert_days} onChange={(e) => setRetentionForm((f) => ({ ...f, alert_days: Number(e.target.value) }))} />
                <Input type="number" placeholder="Incident days" value={retentionForm.incident_days} onChange={(e) => setRetentionForm((f) => ({ ...f, incident_days: Number(e.target.value) }))} />
              </div>
              <Input type="number" placeholder="Run days" value={retentionForm.run_days} onChange={(e) => setRetentionForm((f) => ({ ...f, run_days: Number(e.target.value) }))} />
              <Button disabled={!selectedWorkspaceId} onClick={() => createRetention.mutate()}>
                Save retention policy
              </Button>
              <div className="space-y-2 text-sm text-muted-foreground">
                {retentionPolicies.map((p: any) => (
                  <div key={p.id} className="rounded-lg border border-border bg-background px-3 py-2">
                    {p.name} · logs {p.logs_days}d · metrics {p.metrics_days}d
                  </div>
                ))}
                {!retentionPolicies.length && <div>No retention policies configured.</div>}
              </div>
            </Section>

            <Section title="Escalation Policies" icon={Siren}>
              <Input placeholder="Policy name" value={escalationForm.name} onChange={(e) => setEscalationForm((f) => ({ ...f, name: e.target.value }))} />
              <Textarea placeholder='[{"delay_minutes":0,"channel":"slack"}]' value={escalationForm.steps} onChange={(e) => setEscalationForm((f) => ({ ...f, steps: e.target.value }))} className="min-h-[120px]" />
              <Button disabled={!selectedWorkspaceId} onClick={() => createEscalation.mutate()}>
                Save escalation policy
              </Button>
              <div className="space-y-2 text-sm text-muted-foreground">
                {escalationPolicies.map((p: any) => (
                  <div key={p.id} className="rounded-lg border border-border bg-background px-3 py-2">
                    {p.name}
                  </div>
                ))}
                {!escalationPolicies.length && <div>No escalation policies configured.</div>}
              </div>
            </Section>
          </div>
        </TabsContent>

        <TabsContent value="operations" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-3">
            <Section title="Maintenance Windows" icon={CalendarClock}>
              <Input placeholder="Name" value={maintenanceForm.name} onChange={(e) => setMaintenanceForm((f) => ({ ...f, name: e.target.value }))} />
              <Input type="datetime-local" value={maintenanceForm.starts_at} onChange={(e) => setMaintenanceForm((f) => ({ ...f, starts_at: e.target.value }))} />
              <Input type="datetime-local" value={maintenanceForm.ends_at} onChange={(e) => setMaintenanceForm((f) => ({ ...f, ends_at: e.target.value }))} />
              <Input placeholder="Reason" value={maintenanceForm.reason} onChange={(e) => setMaintenanceForm((f) => ({ ...f, reason: e.target.value }))} />
              <Button disabled={!selectedWorkspaceId} onClick={() => createMaintenance.mutate()}>
                Create maintenance window
              </Button>
              <div className="space-y-2 text-sm text-muted-foreground">
                {maintenanceWindows.map((w: any) => (
                  <div key={w.id} className="rounded-lg border border-border bg-background px-3 py-2">
                    {w.name}
                  </div>
                ))}
                {!maintenanceWindows.length && <div>No maintenance windows yet.</div>}
              </div>
            </Section>

            <Section title="Alert Silences" icon={VolumeX}>
              <Input placeholder="Name" value={silenceForm.name} onChange={(e) => setSilenceForm((f) => ({ ...f, name: e.target.value }))} />
              <Input type="datetime-local" value={silenceForm.starts_at} onChange={(e) => setSilenceForm((f) => ({ ...f, starts_at: e.target.value }))} />
              <Input type="datetime-local" value={silenceForm.ends_at} onChange={(e) => setSilenceForm((f) => ({ ...f, ends_at: e.target.value }))} />
              <Input placeholder='Matcher JSON e.g. {"severity":"info"}' value={silenceForm.matcher} onChange={(e) => setSilenceForm((f) => ({ ...f, matcher: e.target.value }))} />
              <Button disabled={!selectedWorkspaceId} onClick={() => createSilence.mutate()}>
                Create silence
              </Button>
              <div className="space-y-2 text-sm text-muted-foreground">
                {silences.map((s: any) => (
                  <div key={s.id} className="rounded-lg border border-border bg-background px-3 py-2">
                    {s.name}
                  </div>
                ))}
                {!silences.length && <div>No alert silences yet.</div>}
              </div>
            </Section>

            <Section title="Audit Log" icon={ScrollText}>
              <div className="space-y-2 text-sm text-muted-foreground max-h-[420px] overflow-auto">
                {auditLogs.map((log: any) => (
                  <div key={log.id} className="rounded-lg border border-border bg-background px-3 py-2">
                    <div className="font-medium text-foreground">{log.action}</div>
                    <div>
                      {log.resource_type} · {new Date(log.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
                {!auditLogs.length && <div>No audit events yet.</div>}
              </div>
            </Section>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Section title="Enterprise Notification Test" icon={Send}>
              <Select value={notificationForm.channel_id} onChange={(e) => setNotificationForm((f) => ({ ...f, channel_id: e.target.value }))}>
                <option value="">Select channel</option>
                {notificationChannels.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.type}
                  </option>
                ))}
              </Select>
              <Input placeholder="Subject" value={notificationForm.subject} onChange={(e) => setNotificationForm((f) => ({ ...f, subject: e.target.value }))} />
              <Textarea placeholder="Message" value={notificationForm.text} onChange={(e) => setNotificationForm((f) => ({ ...f, text: e.target.value }))} />
              <Button disabled={!notificationForm.channel_id} onClick={() => deliverNotification.mutate()}>
                Send enterprise notification
              </Button>
            </Section>

            <Section title="Compliance & Export" icon={FileSpreadsheet}>
              <Input placeholder="Report type" value={complianceForm.report_type} onChange={(e) => setComplianceForm((f) => ({ ...f, report_type: e.target.value }))} />
              <Input type="datetime-local" value={complianceForm.period_start} onChange={(e) => setComplianceForm((f) => ({ ...f, period_start: e.target.value }))} />
              <Input type="datetime-local" value={complianceForm.period_end} onChange={(e) => setComplianceForm((f) => ({ ...f, period_end: e.target.value }))} />
              <Button disabled={!selectedWorkspaceId} onClick={() => createComplianceReport.mutate()}>
                Generate report
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Export type" value={exportForm.export_type} onChange={(e) => setExportForm((f) => ({ ...f, export_type: e.target.value }))} />
                <Input placeholder="Format" value={exportForm.format} onChange={(e) => setExportForm((f) => ({ ...f, format: e.target.value }))} />
              </div>
              <Button disabled={!selectedWorkspaceId} onClick={() => createExport.mutate()}>
                Create export
              </Button>
              <div className="space-y-2 text-sm text-muted-foreground">
                {complianceReports.map((r: any) => (
                  <div key={r.id} className="rounded-lg border border-border bg-background px-3 py-2">
                    Report: {r.report_type}
                  </div>
                ))}
                {exports.map((x: any) => (
                  <div key={x.id} className="rounded-lg border border-border bg-background px-3 py-2">
                    Export: {x.export_type}.{x.format}
                  </div>
                ))}
                {!complianceReports.length && !exports.length && <div>No reports or exports yet.</div>}
              </div>
            </Section>

            <Section title="API Versions" icon={Waypoints}>
              <div className="space-y-2 text-sm text-muted-foreground">
                {apiVersions.map((v: any) => (
                  <div key={v.id} className="rounded-lg border border-border bg-background px-3 py-2">
                    {v.version}
                    {v.sunset_date ? ` · sunset ${new Date(v.sunset_date).toLocaleDateString()}` : ""}
                  </div>
                ))}
                {!apiVersions.length && <div>No API versions published yet.</div>}
              </div>
            </Section>
          </div>
        </TabsContent>

        <TabsContent value="support" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <Section title="Support" icon={LifeBuoy}>
              <Input placeholder="Subject" value={supportForm.subject} onChange={(e) => setSupportForm((f) => ({ ...f, subject: e.target.value }))} />
              <Textarea placeholder="Describe the issue" value={supportForm.description} onChange={(e) => setSupportForm((f) => ({ ...f, description: e.target.value }))} />
              <Select value={supportForm.priority} onChange={(e) => setSupportForm((f) => ({ ...f, priority: e.target.value }))}>
                <option value="low">low</option>
                <option value="normal">normal</option>
                <option value="high">high</option>
                <option value="urgent">urgent</option>
              </Select>
              <Button disabled={!selectedWorkspaceId} onClick={() => createSupportTicket.mutate()}>
                Create ticket
              </Button>
              <div className="space-y-2 text-sm text-muted-foreground">
                {supportTickets.map((t: any) => (
                  <div key={t.id} className="rounded-lg border border-border bg-background px-3 py-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-foreground">{t.subject}</div>
                      <div className="text-xs uppercase tracking-wide">{t.priority}</div>
                    </div>
                    <div>{t.description}</div>
                    <div className="flex items-center gap-2">
                      <div className="rounded bg-muted px-2 py-1 text-xs uppercase tracking-wide">{t.status}</div>
                      <button className="rounded border border-border px-2 py-1 text-xs text-foreground" onClick={() => updateSupportTicket.mutate({ id: t.id, status: "in_progress" })}>
                        Mark in progress
                      </button>
                      <button className="rounded border border-border px-2 py-1 text-xs text-foreground" onClick={() => updateSupportTicket.mutate({ id: t.id, status: "resolved" })}>
                        Resolve
                      </button>
                    </div>
                  </div>
                ))}
                {!supportTickets.length && <div>No support tickets yet.</div>}
              </div>
            </Section>

            <Section title="Admin Announcements" icon={Megaphone}>
              <Input placeholder="Title" value={announcementForm.title} onChange={(e) => setAnnouncementForm((f) => ({ ...f, title: e.target.value }))} />
              <Textarea placeholder="Message" value={announcementForm.message} onChange={(e) => setAnnouncementForm((f) => ({ ...f, message: e.target.value }))} />
              <div className="grid gap-3 md:grid-cols-2">
                <Input type="datetime-local" value={announcementForm.starts_at} onChange={(e) => setAnnouncementForm((f) => ({ ...f, starts_at: e.target.value }))} />
                <Input type="datetime-local" value={announcementForm.ends_at} onChange={(e) => setAnnouncementForm((f) => ({ ...f, ends_at: e.target.value }))} />
              </div>
              <Button onClick={() => createAnnouncement.mutate()}>Create announcement</Button>
              <div className="space-y-2 text-sm text-muted-foreground">
                {announcements.map((a: any) => (
                  <div key={a.id} className="rounded-lg border border-border bg-background px-3 py-2">
                    {a.title}
                  </div>
                ))}
                {!announcements.length && <div>No announcements yet.</div>}
              </div>
            </Section>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
