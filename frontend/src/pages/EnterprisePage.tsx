import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { api } from "@/lib/api";
import { getWorkspaceId, setWorkspaceId } from "@/lib/workspace";
import { toast } from "@/components/ui/sonner";
import { Building2, ShieldCheck, ScrollText, CalendarClock, VolumeX, KeyRound, TimerReset, Siren, ShieldEllipsis, Users, FileSpreadsheet, LifeBuoy, Megaphone, Waypoints } from "lucide-react";

export default function EnterprisePage() {
  const qc = useQueryClient();
  const [orgForm, setOrgForm] = useState({ name: "", slug: "" });
  const [workspaceForm, setWorkspaceForm] = useState({ organization_id: "", name: "", slug: "", timezone: "Europe/London" });
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

  const { data: organizations = [] } = useQuery({ queryKey: ["enterprise-orgs"], queryFn: api.listOrganizations });
  const selectedOrgId = workspaceForm.organization_id || organizations[0]?.id || "";
  const { data: workspaces = [] } = useQuery({ queryKey: ["enterprise-workspaces", selectedOrgId], queryFn: () => api.listWorkspaces(selectedOrgId || undefined), enabled: !!organizations.length });

  const selectedWorkspaceId = getWorkspaceId() || workspaces[0]?.id || "";

  useEffect(() => {
    if (!getWorkspaceId() && workspaces[0]?.id) setWorkspaceId(workspaces[0].id);
  }, [workspaces]);

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

  const createOrg = useMutation({
    mutationFn: () => api.createOrganization(orgForm),
    onSuccess: () => { toast.success("Organization created"); qc.invalidateQueries({ queryKey: ["enterprise-orgs"] }); setOrgForm({ name: "", slug: "" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createWorkspace = useMutation({
    mutationFn: () => api.createWorkspace({ ...workspaceForm, organization_id: selectedOrgId || workspaceForm.organization_id }),
    onSuccess: (workspace) => {
      toast.success("Workspace created");
      setWorkspaceId(workspace.id);
      qc.invalidateQueries({ queryKey: ["enterprise-workspaces"] });
      setWorkspaceForm({ organization_id: selectedOrgId, name: "", slug: "", timezone: "Europe/London" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createMaintenance = useMutation({
    mutationFn: () => api.createMaintenanceWindow({ ...maintenanceForm, workspace_id: selectedWorkspaceId, scope: {} }),
    onSuccess: () => { toast.success("Maintenance window created"); qc.invalidateQueries({ queryKey: ["enterprise-maintenance"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createSilence = useMutation({
    mutationFn: () => api.createSilence({ ...silenceForm, workspace_id: selectedWorkspaceId, matcher: JSON.parse(silenceForm.matcher) }),
    onSuccess: () => { toast.success("Silence created"); qc.invalidateQueries({ queryKey: ["enterprise-silences"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createOidc = useMutation({
    mutationFn: () => api.createOidcProvider({ ...oidcForm, workspace_id: selectedWorkspaceId, scopes: ["openid", "profile", "email"], enabled: true }),
    onSuccess: () => { toast.success("OIDC provider saved"); qc.invalidateQueries({ queryKey: ["enterprise-oidc"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createRetention = useMutation({
    mutationFn: () => api.createRetentionPolicy({ ...retentionForm, workspace_id: selectedWorkspaceId, enabled: true }),
    onSuccess: () => { toast.success("Retention policy saved"); qc.invalidateQueries({ queryKey: ["enterprise-retention"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createEscalation = useMutation({
    mutationFn: () => api.createEscalationPolicy({ workspace_id: selectedWorkspaceId, name: escalationForm.name, target_type: "all", steps: JSON.parse(escalationForm.steps), enabled: true }),
    onSuccess: () => { toast.success("Escalation policy saved"); qc.invalidateQueries({ queryKey: ["enterprise-escalation"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createSaml = useMutation({
    mutationFn: () => api.createSamlProvider({ ...samlForm, workspace_id: selectedWorkspaceId, enabled: true }),
    onSuccess: () => { toast.success("SAML provider saved"); qc.invalidateQueries({ queryKey: ["enterprise-saml"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createScimToken = useMutation({
    mutationFn: () => api.createScimToken({ ...scimTokenForm, workspace_id: selectedWorkspaceId }),
    onSuccess: () => { toast.success("SCIM token created"); qc.invalidateQueries({ queryKey: ["enterprise-scim-tokens"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createScimMapping = useMutation({
    mutationFn: () => api.createScimGroupMapping({ ...scimMappingForm, workspace_id: selectedWorkspaceId }),
    onSuccess: () => { toast.success("SCIM mapping saved"); qc.invalidateQueries({ queryKey: ["enterprise-scim-mappings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createComplianceReport = useMutation({
    mutationFn: () => api.createComplianceReport({ ...complianceForm, workspace_id: selectedWorkspaceId }),
    onSuccess: () => { toast.success("Compliance report generated"); qc.invalidateQueries({ queryKey: ["enterprise-compliance"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createExport = useMutation({
    mutationFn: () => api.createExport({ ...exportForm, workspace_id: selectedWorkspaceId, filters: {} }),
    onSuccess: () => { toast.success("Export created"); qc.invalidateQueries({ queryKey: ["enterprise-exports"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createSupportTicket = useMutation({
    mutationFn: () => api.createSupportTicket({ ...supportForm, workspace_id: selectedWorkspaceId }),
    onSuccess: () => { toast.success("Support ticket created"); qc.invalidateQueries({ queryKey: ["enterprise-support"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createAnnouncement = useMutation({
    mutationFn: () => api.createAnnouncement(announcementForm),
    onSuccess: () => { toast.success("Announcement created"); qc.invalidateQueries({ queryKey: ["enterprise-announcements"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const selectedWorkspace = useMemo(() => workspaces.find((w: any) => w.id === selectedWorkspaceId), [workspaces, selectedWorkspaceId]);

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Enterprise" description="Organizations, workspaces, audit, maintenance, silences, and OIDC foundations" />

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2 text-foreground font-semibold"><Building2 className="h-4 w-4 text-primary" /> Organization & Workspace</div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <input placeholder="Organization name" value={orgForm.name} onChange={(e) => setOrgForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
              <input placeholder="org-slug" value={orgForm.slug} onChange={(e) => setOrgForm((f) => ({ ...f, slug: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
              <button onClick={() => createOrg.mutate()} className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Create organization</button>
            </div>
            <div className="space-y-3">
              <select value={selectedOrgId} onChange={(e) => setWorkspaceForm((f) => ({ ...f, organization_id: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
                <option value="">Select organization</option>
                {organizations.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <input placeholder="Workspace name" value={workspaceForm.name} onChange={(e) => setWorkspaceForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
              <input placeholder="workspace-slug" value={workspaceForm.slug} onChange={(e) => setWorkspaceForm((f) => ({ ...f, slug: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
              <button onClick={() => createWorkspace.mutate()} className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Create workspace</button>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-background p-3 text-sm text-muted-foreground">
            Active workspace: <span className="font-medium text-foreground">{selectedWorkspace?.name || "None"}</span>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2 text-foreground font-semibold"><KeyRound className="h-4 w-4 text-primary" /> OIDC Provider</div>
          <div className="grid gap-3 md:grid-cols-2">
            <input placeholder="Provider name" value={oidcForm.name} onChange={(e) => setOidcForm((f) => ({ ...f, name: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
            <input placeholder="Issuer" value={oidcForm.issuer} onChange={(e) => setOidcForm((f) => ({ ...f, issuer: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
            <input placeholder="Client ID" value={oidcForm.client_id} onChange={(e) => setOidcForm((f) => ({ ...f, client_id: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
            <input placeholder="Client Secret" value={oidcForm.client_secret} onChange={(e) => setOidcForm((f) => ({ ...f, client_secret: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
            <input placeholder="Authorize URL" value={oidcForm.authorize_url} onChange={(e) => setOidcForm((f) => ({ ...f, authorize_url: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
            <input placeholder="Token URL" value={oidcForm.token_url} onChange={(e) => setOidcForm((f) => ({ ...f, token_url: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          </div>
          <button onClick={() => createOidc.mutate()} disabled={!selectedWorkspaceId} className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Save OIDC provider</button>
          <div className="space-y-2 text-sm text-muted-foreground">
            {oidcProviders.map((p: any) => <div key={p.id} className="rounded-lg border border-border bg-background px-3 py-2">{p.name} · {p.issuer}</div>)}
            {!oidcProviders.length && <div>No OIDC providers configured.</div>}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2 text-foreground font-semibold"><TimerReset className="h-4 w-4 text-primary" /> Retention Policies</div>
          <input placeholder="Policy name" value={retentionForm.name} onChange={(e) => setRetentionForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <input type="number" placeholder="Logs days" value={retentionForm.logs_days} onChange={(e) => setRetentionForm((f) => ({ ...f, logs_days: Number(e.target.value) }))} className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
            <input type="number" placeholder="Metrics days" value={retentionForm.metrics_days} onChange={(e) => setRetentionForm((f) => ({ ...f, metrics_days: Number(e.target.value) }))} className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
            <input type="number" placeholder="Alert days" value={retentionForm.alert_days} onChange={(e) => setRetentionForm((f) => ({ ...f, alert_days: Number(e.target.value) }))} className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
            <input type="number" placeholder="Incident days" value={retentionForm.incident_days} onChange={(e) => setRetentionForm((f) => ({ ...f, incident_days: Number(e.target.value) }))} className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          </div>
          <input type="number" placeholder="Run days" value={retentionForm.run_days} onChange={(e) => setRetentionForm((f) => ({ ...f, run_days: Number(e.target.value) }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          <button onClick={() => createRetention.mutate()} disabled={!selectedWorkspaceId} className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Save retention policy</button>
          <div className="space-y-2 text-sm text-muted-foreground">{retentionPolicies.map((p: any) => <div key={p.id} className="rounded-lg border border-border bg-background px-3 py-2">{p.name} · logs {p.logs_days}d · metrics {p.metrics_days}d</div>)}</div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2 text-foreground font-semibold"><Siren className="h-4 w-4 text-primary" /> Escalation Policies</div>
          <input placeholder="Policy name" value={escalationForm.name} onChange={(e) => setEscalationForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          <textarea placeholder='[{"delay_minutes":0,"channel":"slack"}]' value={escalationForm.steps} onChange={(e) => setEscalationForm((f) => ({ ...f, steps: e.target.value }))} className="min-h-[120px] w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          <button onClick={() => createEscalation.mutate()} disabled={!selectedWorkspaceId} className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Save escalation policy</button>
          <div className="space-y-2 text-sm text-muted-foreground">{escalationPolicies.map((p: any) => <div key={p.id} className="rounded-lg border border-border bg-background px-3 py-2">{p.name}</div>)}</div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2 text-foreground font-semibold"><CalendarClock className="h-4 w-4 text-primary" /> Maintenance Windows</div>
          <input placeholder="Name" value={maintenanceForm.name} onChange={(e) => setMaintenanceForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          <input type="datetime-local" value={maintenanceForm.starts_at} onChange={(e) => setMaintenanceForm((f) => ({ ...f, starts_at: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          <input type="datetime-local" value={maintenanceForm.ends_at} onChange={(e) => setMaintenanceForm((f) => ({ ...f, ends_at: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          <input placeholder="Reason" value={maintenanceForm.reason} onChange={(e) => setMaintenanceForm((f) => ({ ...f, reason: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          <button onClick={() => createMaintenance.mutate()} disabled={!selectedWorkspaceId} className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Create maintenance window</button>
          <div className="space-y-2 text-sm text-muted-foreground">{maintenanceWindows.map((w: any) => <div key={w.id} className="rounded-lg border border-border bg-background px-3 py-2">{w.name}</div>)}</div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2 text-foreground font-semibold"><VolumeX className="h-4 w-4 text-primary" /> Alert Silences</div>
          <input placeholder="Name" value={silenceForm.name} onChange={(e) => setSilenceForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          <input type="datetime-local" value={silenceForm.starts_at} onChange={(e) => setSilenceForm((f) => ({ ...f, starts_at: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          <input type="datetime-local" value={silenceForm.ends_at} onChange={(e) => setSilenceForm((f) => ({ ...f, ends_at: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          <input placeholder='Matcher JSON e.g. {"severity":"info"}' value={silenceForm.matcher} onChange={(e) => setSilenceForm((f) => ({ ...f, matcher: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          <button onClick={() => createSilence.mutate()} disabled={!selectedWorkspaceId} className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Create silence</button>
          <div className="space-y-2 text-sm text-muted-foreground">{silences.map((s: any) => <div key={s.id} className="rounded-lg border border-border bg-background px-3 py-2">{s.name}</div>)}</div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2 text-foreground font-semibold"><ScrollText className="h-4 w-4 text-primary" /> Audit Log</div>
          <div className="space-y-2 text-sm text-muted-foreground max-h-[420px] overflow-auto">
            {auditLogs.map((log: any) => (
              <div key={log.id} className="rounded-lg border border-border bg-background px-3 py-2">
                <div className="font-medium text-foreground">{log.action}</div>
                <div>{log.resource_type} · {new Date(log.created_at).toLocaleString()}</div>
              </div>
            ))}
            {!auditLogs.length && <div>No audit events yet.</div>}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2 text-foreground font-semibold"><ShieldEllipsis className="h-4 w-4 text-primary" /> SAML</div>
          <input placeholder="Provider name" value={samlForm.name} onChange={(e) => setSamlForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          <input placeholder="Entry point" value={samlForm.entry_point} onChange={(e) => setSamlForm((f) => ({ ...f, entry_point: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          <textarea placeholder="X509 cert" value={samlForm.x509_cert} onChange={(e) => setSamlForm((f) => ({ ...f, x509_cert: e.target.value }))} className="min-h-[100px] w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          <button onClick={() => createSaml.mutate()} disabled={!selectedWorkspaceId} className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Save SAML provider</button>
          <div className="space-y-2 text-sm text-muted-foreground">{samlProviders.map((p: any) => <div key={p.id} className="rounded-lg border border-border bg-background px-3 py-2">{p.name}</div>)}</div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2 text-foreground font-semibold"><Users className="h-4 w-4 text-primary" /> SCIM</div>
          <input placeholder="Token name" value={scimTokenForm.name} onChange={(e) => setScimTokenForm({ name: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          <button onClick={() => createScimToken.mutate()} disabled={!selectedWorkspaceId} className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Create SCIM token</button>
          <input placeholder="External group ID" value={scimMappingForm.external_group_id} onChange={(e) => setScimMappingForm((f) => ({ ...f, external_group_id: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          <input placeholder="External group name" value={scimMappingForm.external_group_name} onChange={(e) => setScimMappingForm((f) => ({ ...f, external_group_name: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          <button onClick={() => createScimMapping.mutate()} disabled={!selectedWorkspaceId} className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Save group mapping</button>
          <div className="space-y-2 text-sm text-muted-foreground">
            {scimTokens.map((t: any) => <div key={t.id} className="rounded-lg border border-border bg-background px-3 py-2">Token: {t.name}</div>)}
            {scimMappings.map((m: any) => <div key={m.id} className="rounded-lg border border-border bg-background px-3 py-2">{m.external_group_name} → {m.role}</div>)}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2 text-foreground font-semibold"><Waypoints className="h-4 w-4 text-primary" /> API Versions</div>
          <div className="space-y-2 text-sm text-muted-foreground">
            {apiVersions.map((v: any) => <div key={v.id} className="rounded-lg border border-border bg-background px-3 py-2">{v.version} {v.sunset_date ? `· sunset ${new Date(v.sunset_date).toLocaleDateString()}` : ""}</div>)}
            {!apiVersions.length && <div>No API versions published yet.</div>}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2 text-foreground font-semibold"><FileSpreadsheet className="h-4 w-4 text-primary" /> Compliance & Export</div>
          <input placeholder="Report type" value={complianceForm.report_type} onChange={(e) => setComplianceForm((f) => ({ ...f, report_type: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          <input type="datetime-local" value={complianceForm.period_start} onChange={(e) => setComplianceForm((f) => ({ ...f, period_start: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          <input type="datetime-local" value={complianceForm.period_end} onChange={(e) => setComplianceForm((f) => ({ ...f, period_end: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          <button onClick={() => createComplianceReport.mutate()} disabled={!selectedWorkspaceId} className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Generate report</button>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Export type" value={exportForm.export_type} onChange={(e) => setExportForm((f) => ({ ...f, export_type: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
            <input placeholder="Format" value={exportForm.format} onChange={(e) => setExportForm((f) => ({ ...f, format: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          </div>
          <button onClick={() => createExport.mutate()} disabled={!selectedWorkspaceId} className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Create export</button>
          <div className="space-y-2 text-sm text-muted-foreground">
            {complianceReports.map((r: any) => <div key={r.id} className="rounded-lg border border-border bg-background px-3 py-2">Report: {r.report_type}</div>)}
            {exports.map((x: any) => <div key={x.id} className="rounded-lg border border-border bg-background px-3 py-2">Export: {x.export_type}.{x.format}</div>)}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2 text-foreground font-semibold"><LifeBuoy className="h-4 w-4 text-primary" /> Support</div>
          <input placeholder="Subject" value={supportForm.subject} onChange={(e) => setSupportForm((f) => ({ ...f, subject: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          <textarea placeholder="Describe the issue" value={supportForm.description} onChange={(e) => setSupportForm((f) => ({ ...f, description: e.target.value }))} className="min-h-[100px] w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          <button onClick={() => createSupportTicket.mutate()} disabled={!selectedWorkspaceId} className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Create ticket</button>
          <div className="space-y-2 text-sm text-muted-foreground">{supportTickets.map((t: any) => <div key={t.id} className="rounded-lg border border-border bg-background px-3 py-2">{t.subject} · {t.status}</div>)}</div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2 text-foreground font-semibold"><Megaphone className="h-4 w-4 text-primary" /> Admin Announcements</div>
          <input placeholder="Title" value={announcementForm.title} onChange={(e) => setAnnouncementForm((f) => ({ ...f, title: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          <textarea placeholder="Message" value={announcementForm.message} onChange={(e) => setAnnouncementForm((f) => ({ ...f, message: e.target.value }))} className="min-h-[100px] w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          <input type="datetime-local" value={announcementForm.starts_at} onChange={(e) => setAnnouncementForm((f) => ({ ...f, starts_at: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          <input type="datetime-local" value={announcementForm.ends_at} onChange={(e) => setAnnouncementForm((f) => ({ ...f, ends_at: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          <button onClick={() => createAnnouncement.mutate()} className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Create announcement</button>
          <div className="space-y-2 text-sm text-muted-foreground">{announcements.map((a: any) => <div key={a.id} className="rounded-lg border border-border bg-background px-3 py-2">{a.title}</div>)}</div>
        </section>
      </div>
    </div>
  );
}
