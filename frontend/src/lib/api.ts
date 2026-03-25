import { getWorkspaceId } from "@/lib/workspace";

const API_BASE = import.meta.env.VITE_API_URL || "";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("argus_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const workspaceId = getWorkspaceId();
  if (workspaceId) {
    headers["X-Workspace-Id"] = workspaceId;
  }

  const res = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    localStorage.removeItem("argus_token");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ access_token: string; workspace_id?: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string, name: string) =>
    request<{ access_token: string; workspace_id?: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    }),

  me: () => request<{ id: string; email: string; name: string; role: string; timezone: string; is_active: boolean }>("/auth/me"),
  oidcStart: (workspaceSlug: string) => request<{ authorize_url: string; state: string }>(`/auth/oidc/start?workspace_slug=${encodeURIComponent(workspaceSlug)}`),
  oidcCallback: (code: string, state: string) =>
    request<{ access_token: string; workspace_id?: string }>("/auth/oidc/callback", {
      method: "POST",
      body: JSON.stringify({ code, state }),
    }),
  samlStart: (workspaceSlug: string) => request<{ entry_point: string; relay_state: string; idp_entry_point: string }>(`/auth/saml/start?workspace_slug=${encodeURIComponent(workspaceSlug)}`),
  samlAcs: (SAMLResponse: string, RelayState: string) =>
    request<{ access_token: string; workspace_id?: string }>("/auth/saml/acs", {
      method: "POST",
      body: JSON.stringify({ SAMLResponse, RelayState }),
    }),

  // Meta
  getMeta: () => request<{ app_name: string; demo_mode: boolean }>("/meta"),

  // Overview
  overviewStats: () => request<any>("/overview/stats"),
  overviewHostHealth: () => request<any[]>("/overview/host-health"),
  overviewRecentAlerts: () => request<any[]>("/overview/recent-alerts"),
  overviewRecentIncidents: () => request<any[]>("/overview/recent-incidents"),
  overviewTransactionSummary: () => request<any[]>("/overview/transaction-summary"),

  // Search
  globalSearch: (q: string) =>
    request<any[]>(`/search?q=${encodeURIComponent(q)}`),

  // Hosts
  listHosts: (params?: { type?: string; status?: string; search?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.type && params.type !== "all") qs.set("type", params.type);
    if (params?.status && params.status !== "all") qs.set("status", params.status);
    if (params?.search) qs.set("search", params.search);
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    const q = qs.toString();
    return request<{ items: any[]; total: number; limit: number; offset: number }>(`/hosts${q ? `?${q}` : ""}`);
  },
  getHostCounts: () => request<{ all: number; server: number; database: number; container: number; network: number; live_agent_hosts: number }>("/hosts/counts"),
  createHost: (data: any) =>
    request<any>("/hosts", { method: "POST", body: JSON.stringify(data) }),
  getHost: (id: string) => request<any>(`/hosts/${id}`),
  getHostMetrics: (id: string, hours = 24) => request<any>(`/hosts/${id}/metrics?hours=${hours}`),
  deleteHost: (id: string) =>
    request<void>(`/hosts/${id}`, { method: "DELETE" }),

  // Services
  listServices: (params?: { search?: string; status?: string; hostId?: string; pluginId?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.status && params.status !== "all") qs.set("status", params.status);
    if (params?.hostId) qs.set("host_id", params.hostId);
    if (params?.pluginId && params.pluginId !== "all") qs.set("plugin_id", params.pluginId);
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    const q = qs.toString();
    return request<{ items: any[]; total: number; limit: number; offset: number }>(`/services${q ? `?${q}` : ""}`);
  },
  getServiceHistory: (id: string, hours = 24) => request<any[]>(`/services/${id}/history?hours=${hours}`),
  createService: (data: any) =>
    request<any>("/services", { method: "POST", body: JSON.stringify(data) }),
  discoverServices: () =>
    request<{ created: number; discovered: any[] }>("/services/discover", { method: "POST" }),
  seedDefaultAlerts: () =>
    request<{ created: number; total_defaults: number }>("/services/seed-defaults", { method: "POST" }),

  // Monitors
  listMonitors: () => request<any[]>("/monitors"),
  createMonitor: (data: any) =>
    request<any>("/monitors", { method: "POST", body: JSON.stringify(data) }),

  // Transactions
  listTransactions: () => request<any[]>("/transactions"),
  getTransaction: (id: string) => request<any>(`/transactions/${id}`),
  createTransaction: (data: any) =>
    request<any>("/transactions", { method: "POST", body: JSON.stringify(data) }),
  updateTransaction: (id: string, data: any) =>
    request<any>(`/transactions/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTransaction: (id: string) =>
    request<void>(`/transactions/${id}`, { method: "DELETE" }),
  runTransaction: (id: string) =>
    request<any>(`/transactions/${id}/run`, { method: "POST" }),
  listTransactionRuns: (id: string, limit = 20) =>
    request<any[]>(`/transactions/${id}/runs?limit=${limit}`),

  // Alerts
  listAlerts: (params?: { severity?: string; acknowledged?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.severity && params.severity !== "all") qs.set("severity", params.severity);
    if (params?.acknowledged !== undefined) qs.set("acknowledged", String(params.acknowledged));
    const q = qs.toString();
    return request<any[]>(`/alerts${q ? `?${q}` : ""}`);
  },
  listAlertRules: () => request<any[]>("/alerts/rules"),
  createAlertRule: (data: any) =>
    request<any>("/alerts/rules", { method: "POST", body: JSON.stringify(data) }),
  acknowledgeAlert: (id: string) =>
    request<any>(`/alerts/${id}/acknowledge`, { method: "POST" }),
  resolveAlert: (id: string) =>
    request<any>(`/alerts/${id}/resolve`, { method: "POST" }),

  // Incidents
  listIncidents: () => request<any[]>("/incidents"),
  createIncident: (data: any) =>
    request<any>("/incidents", { method: "POST", body: JSON.stringify(data) }),
  addIncidentEvent: (id: string, data: any) =>
    request<any>(`/incidents/${id}/events`, { method: "POST", body: JSON.stringify(data) }),
  resolveIncident: (id: string) =>
    request<any>(`/incidents/${id}/resolve`, { method: "POST" }),

  // Logs
  listLogs: (params?: { level?: string; search?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.level && params.level !== "all") qs.set("level", params.level);
    if (params?.search) qs.set("search", params.search);
    if (params?.limit) qs.set("limit", String(params.limit));
    const q = qs.toString();
    return request<any[]>(`/logs${q ? `?${q}` : ""}`);
  },

  // Dashboards
  listDashboards: () => request<any[]>("/dashboards"),
  listDashboardTemplates: () => request<any[]>("/dashboards/templates"),
  getDashboard: (id: string) => request<any>(`/dashboards/${id}`),
  getDashboardWidgets: (id: string) => request<any[]>(`/dashboards/${id}/widgets`),
  createDashboard: (data: any) =>
    request<any>("/dashboards", { method: "POST", body: JSON.stringify(data) }),

  // AI
  aiSessions: () => request<any[]>("/ai/sessions"),
  aiCreateSession: (title?: string) =>
    request<any>("/ai/sessions", { method: "POST", body: JSON.stringify({ title }) }),
  aiChat: (message: string, sessionId?: string) =>
    request<{ role: string; content: string; timestamp: string; session_id?: string }>("/ai/chat", {
      method: "POST",
      body: JSON.stringify({ message, session_id: sessionId ?? null }),
    }),
  aiHistory: (sessionId?: string) => request<any[]>(`/ai/history${sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ""}`),
  aiGenerateTransaction: (prompt: string, url?: string) =>
    request<any>("/ai/generate-transaction", {
      method: "POST",
      body: JSON.stringify({ prompt, url: url || null }),
    }),
  aiExplainFailure: (runId: string) =>
    request<{ explanation: string }>("/ai/explain-failure", {
      method: "POST",
      body: JSON.stringify({ run_id: runId }),
    }),

  // On-call
  listOnCallTeams: () => request<any[]>("/oncall/teams"),
  createOnCallTeam: (data: any) =>
    request<any>("/oncall/teams", { method: "POST", body: JSON.stringify(data) }),
  addOnCallTeamMember: (teamId: string, data: any) =>
    request<any>(`/oncall/teams/${teamId}/members`, { method: "POST", body: JSON.stringify(data) }),
  listOnCallShifts: (teamId?: string) => request<any[]>(`/oncall/shifts${teamId ? `?team_id=${encodeURIComponent(teamId)}` : ""}`),
  createOnCallShift: (data: any) =>
    request<any>("/oncall/shifts", { method: "POST", body: JSON.stringify(data) }),

  // Users
  listUsers: () => request<any[]>("/users"),
  createUser: (data: any) => request<any>("/users", { method: "POST", body: JSON.stringify(data) }),
  updateUser: (id: string, data: any) => request<any>(`/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  // Enterprise
  listOrganizations: () => request<any[]>("/enterprise/organizations"),
  createOrganization: (data: { name: string; slug: string }) =>
    request<any>("/enterprise/organizations", { method: "POST", body: JSON.stringify(data) }),
  listWorkspaces: (organizationId?: string) =>
    request<any[]>(`/enterprise/workspaces${organizationId ? `?organization_id=${encodeURIComponent(organizationId)}` : ""}`),
  createWorkspace: (data: { organization_id: string; name: string; slug: string; timezone?: string }) =>
    request<any>("/enterprise/workspaces", { method: "POST", body: JSON.stringify(data) }),
  listWorkspaceMembers: (workspaceId: string) =>
    request<any[]>(`/enterprise/workspaces/${workspaceId}/members`),
  addWorkspaceMember: (workspaceId: string, data: { user_id: string; role: string }) =>
    request<any>(`/enterprise/workspaces/${workspaceId}/members`, { method: "POST", body: JSON.stringify(data) }),
  listAuditLogs: (workspaceId?: string, limit?: number) =>
    request<any[]>(`/enterprise/audit-logs${workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : ""}${limit ? `${workspaceId ? "&" : "?"}limit=${limit}` : ""}`),
  listMaintenanceWindows: (workspaceId: string) =>
    request<any[]>(`/enterprise/maintenance-windows?workspace_id=${encodeURIComponent(workspaceId)}`),
  createMaintenanceWindow: (data: any) =>
    request<any>("/enterprise/maintenance-windows", { method: "POST", body: JSON.stringify(data) }),
  listSilences: (workspaceId: string) =>
    request<any[]>(`/enterprise/silences?workspace_id=${encodeURIComponent(workspaceId)}`),
  createSilence: (data: any) =>
    request<any>("/enterprise/silences", { method: "POST", body: JSON.stringify(data) }),
  listOidcProviders: (workspaceId: string) =>
    request<any[]>(`/enterprise/oidc/providers?workspace_id=${encodeURIComponent(workspaceId)}`),
  createOidcProvider: (data: any) =>
    request<any>("/enterprise/oidc/providers", { method: "POST", body: JSON.stringify(data) }),
  listRetentionPolicies: (workspaceId: string) =>
    request<any[]>(`/enterprise/retention-policies?workspace_id=${encodeURIComponent(workspaceId)}`),
  createRetentionPolicy: (data: any) =>
    request<any>("/enterprise/retention-policies", { method: "POST", body: JSON.stringify(data) }),
  listEscalationPolicies: (workspaceId: string) =>
    request<any[]>(`/enterprise/escalation-policies?workspace_id=${encodeURIComponent(workspaceId)}`),
  createEscalationPolicy: (data: any) =>
    request<any>("/enterprise/escalation-policies", { method: "POST", body: JSON.stringify(data) }),
  listSamlProviders: (workspaceId: string) =>
    request<any[]>(`/enterprise/saml/providers?workspace_id=${encodeURIComponent(workspaceId)}`),
  createSamlProvider: (data: any) =>
    request<any>("/enterprise/saml/providers", { method: "POST", body: JSON.stringify(data) }),
  listScimTokens: (workspaceId: string) =>
    request<any[]>(`/enterprise/scim/tokens?workspace_id=${encodeURIComponent(workspaceId)}`),
  createScimToken: (data: any) =>
    request<any>("/enterprise/scim/tokens", { method: "POST", body: JSON.stringify(data) }),
  listScimGroupMappings: (workspaceId: string) =>
    request<any[]>(`/enterprise/scim/group-mappings?workspace_id=${encodeURIComponent(workspaceId)}`),
  createScimGroupMapping: (data: any) =>
    request<any>("/enterprise/scim/group-mappings", { method: "POST", body: JSON.stringify(data) }),
  listComplianceReports: (workspaceId: string) =>
    request<any[]>(`/enterprise/compliance-reports?workspace_id=${encodeURIComponent(workspaceId)}`),
  createComplianceReport: (data: any) =>
    request<any>("/enterprise/compliance-reports", { method: "POST", body: JSON.stringify(data) }),
  listExports: (workspaceId: string) =>
    request<any[]>(`/enterprise/exports?workspace_id=${encodeURIComponent(workspaceId)}`),
  createExport: (data: any) =>
    request<any>("/enterprise/exports", { method: "POST", body: JSON.stringify(data) }),
  listSupportTickets: (workspaceId: string) =>
    request<any[]>(`/enterprise/support/tickets?workspace_id=${encodeURIComponent(workspaceId)}`),
  createSupportTicket: (data: any) =>
    request<any>("/enterprise/support/tickets", { method: "POST", body: JSON.stringify(data) }),
  updateSupportTicket: (id: string, data: any) =>
    request<any>(`/enterprise/support/tickets/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  listAnnouncements: () => request<any[]>("/enterprise/announcements"),
  createAnnouncement: (data: any) =>
    request<any>("/enterprise/announcements", { method: "POST", body: JSON.stringify(data) }),
  deliverEnterpriseNotification: (channelId: string, data: { subject?: string; text: string; message?: string }) =>
    request<any>(`/enterprise/notifications/${channelId}/deliver`, { method: "POST", body: JSON.stringify(data) }),
  listApiVersions: () => request<any[]>("/enterprise/api-versions"),

  // Settings - Profile
  getProfile: () => request<any>("/settings/profile"),
  updateProfile: (data: { name?: string; email?: string }) =>
    request<any>("/settings/profile", { method: "PUT", body: JSON.stringify(data) }),
  changePassword: (data: { current_password: string; new_password: string }) =>
    request<any>("/settings/profile/password", { method: "POST", body: JSON.stringify(data) }),

  // Settings - API Keys
  listApiKeys: () => request<any[]>("/settings/api-keys"),
  createApiKey: (name: string) =>
    request<any>("/settings/api-keys", { method: "POST", body: JSON.stringify({ name }) }),
  deleteApiKey: (id: string) =>
    request<void>(`/settings/api-keys/${id}`, { method: "DELETE" }),

  // Settings - Notifications
  listNotificationChannels: () => request<any[]>("/settings/notifications"),
  createNotificationChannel: (data: any) =>
    request<any>("/settings/notifications", { method: "POST", body: JSON.stringify(data) }),
  updateNotificationChannel: (id: string, data: any) =>
    request<any>(`/settings/notifications/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteNotificationChannel: (id: string) =>
    request<void>(`/settings/notifications/${id}`, { method: "DELETE" }),
  testNotificationChannel: (id: string) =>
    request<any>(`/settings/notifications/${id}/test`, { method: "POST" }),

  // Settings - Integrations
  listIntegrations: () => request<any[]>("/settings/integrations"),
  createIntegration: (data: any) =>
    request<any>("/settings/integrations", { method: "POST", body: JSON.stringify(data) }),
  updateIntegration: (id: string, data: any) =>
    request<any>(`/settings/integrations/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteIntegration: (id: string) =>
    request<void>(`/settings/integrations/${id}`, { method: "DELETE" }),

  // Settings - Preferences
  getPreferences: () => request<any>("/settings/preferences"),
  updatePreferences: (data: any) =>
    request<any>("/settings/preferences", { method: "PUT", body: JSON.stringify(data) }),

  // Settings - Agents
  rotateHostEnrollmentToken: (hostId: string, options?: { scope?: string; ttlHours?: number }) => {
    const params = new URLSearchParams();
    if (options?.scope) params.set("scope", options.scope);
    if (options?.ttlHours) params.set("ttl_hours", String(options.ttlHours));
    const qs = params.toString();
    return request<{ host_id: string; token: string; scope: string; status: string; expires_at: string | null; revoked_at?: string | null; install_url: string; command: string }>(`/hosts/${hostId}/enrollment-token${qs ? `?${qs}` : ""}`, { method: "POST" });
  },
  revokeHostEnrollmentToken: (hostId: string) => request<{ host_id: string; status: string }>(`/hosts/${hostId}/enrollment-token`, { method: "DELETE" }),
  getAgentInstallInfo: () => request<{ token: string; command: string; script_url: string; notes: string[] }>("/settings/agent-install"),
  listAgents: () => request<any[]>("/settings/agents"),

  // Kubernetes
  listK8sClusters: () => request<any[]>("/kubernetes/clusters"),
  createK8sCluster: (data: any) =>
    request<any>("/kubernetes/clusters", { method: "POST", body: JSON.stringify(data) }),
  getK8sCluster: (id: string) => request<any>(`/kubernetes/clusters/${id}`),
  updateK8sCluster: (id: string, data: any) =>
    request<any>(`/kubernetes/clusters/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteK8sCluster: (id: string) =>
    request<void>(`/kubernetes/clusters/${id}`, { method: "DELETE" }),
  discoverK8sCluster: (id: string) =>
    request<any>(`/kubernetes/clusters/${id}/discover`, { method: "POST" }),
  listK8sNamespaces: (clusterId: string) =>
    request<any[]>(`/kubernetes/clusters/${clusterId}/namespaces`),
  listK8sNodes: (clusterId: string) =>
    request<any[]>(`/kubernetes/clusters/${clusterId}/nodes`),
  listK8sPods: (clusterId: string, namespace?: string, status?: string) => {
    const params = new URLSearchParams();
    if (namespace) params.set("namespace", namespace);
    if (status) params.set("status", status);
    const qs = params.toString();
    return request<any[]>(`/kubernetes/clusters/${clusterId}/pods${qs ? `?${qs}` : ""}`);
  },
  listK8sDeployments: (clusterId: string, namespace?: string) => {
    const params = new URLSearchParams();
    if (namespace) params.set("namespace", namespace);
    const qs = params.toString();
    return request<any[]>(`/kubernetes/clusters/${clusterId}/deployments${qs ? `?${qs}` : ""}`);
  },
  listK8sStatefulSets: (clusterId: string, namespace?: string) => {
    const params = new URLSearchParams();
    if (namespace) params.set("namespace", namespace);
    const qs = params.toString();
    return request<any[]>(`/kubernetes/clusters/${clusterId}/statefulsets${qs ? `?${qs}` : ""}`);
  },
  listK8sDaemonSets: (clusterId: string, namespace?: string) => {
    const params = new URLSearchParams();
    if (namespace) params.set("namespace", namespace);
    const qs = params.toString();
    return request<any[]>(`/kubernetes/clusters/${clusterId}/daemonsets${qs ? `?${qs}` : ""}`);
  },
  listK8sJobs: (clusterId: string, namespace?: string) => {
    const params = new URLSearchParams();
    if (namespace) params.set("namespace", namespace);
    const qs = params.toString();
    return request<any[]>(`/kubernetes/clusters/${clusterId}/jobs${qs ? `?${qs}` : ""}`);
  },
  listK8sServices: (clusterId: string, namespace?: string) => {
    const params = new URLSearchParams();
    if (namespace) params.set("namespace", namespace);
    const qs = params.toString();
    return request<any[]>(`/kubernetes/clusters/${clusterId}/services${qs ? `?${qs}` : ""}`);
  },
  listK8sEvents: (clusterId: string, namespace?: string, limit = 100) => {
    const params = new URLSearchParams();
    if (namespace) params.set("namespace", namespace);
    params.set("limit", String(limit));
    return request<any[]>(`/kubernetes/clusters/${clusterId}/events?${params.toString()}`);
  },
  getK8sClusterStats: (clusterId: string) =>
    request<any>(`/kubernetes/clusters/${clusterId}/stats`),

  listSwarmClusters: () => request<any[]>(`/swarm/clusters`),
  createSwarmCluster: (data: any) => request<any>(`/swarm/clusters`, { method: "POST", body: data }),
  discoverSwarmCluster: (clusterId: string) => request<any>(`/swarm/clusters/${clusterId}/discover`, { method: "POST" }),
  deleteSwarmCluster: (clusterId: string) => request<void>(`/swarm/clusters/${clusterId}`, { method: "DELETE" }),
  listSwarmNodes: (clusterId: string) => request<any[]>(`/swarm/clusters/${clusterId}/nodes`),
  listSwarmServices: (clusterId: string, stack?: string) => request<any[]>(`/swarm/clusters/${clusterId}/services${stack ? `?stack=${encodeURIComponent(stack)}` : ""}`),
  listSwarmTasks: (clusterId: string, stack?: string) => request<any[]>(`/swarm/clusters/${clusterId}/tasks${stack ? `?stack=${encodeURIComponent(stack)}` : ""}`),
  listSwarmNetworks: (clusterId: string) => request<any[]>(`/swarm/clusters/${clusterId}/networks`),
  listSwarmVolumes: (clusterId: string) => request<any[]>(`/swarm/clusters/${clusterId}/volumes`),
  listSwarmEvents: (clusterId: string, limit = 100) => request<any[]>(`/swarm/clusters/${clusterId}/events?limit=${limit}`),
  getSwarmClusterStats: (clusterId: string) => request<any>(`/swarm/clusters/${clusterId}/stats`),

  // Proxmox
  listProxmoxClusters: () => request<any[]>(`/proxmox/clusters`),
  createProxmoxCluster: (data: any) => request<any>(`/proxmox/clusters`, { method: "POST", body: JSON.stringify(data) }),
  discoverProxmoxCluster: (clusterId: string) => request<any>(`/proxmox/clusters/${clusterId}/discover`, { method: "POST" }),
  deleteProxmoxCluster: (clusterId: string) => request<void>(`/proxmox/clusters/${clusterId}`, { method: "DELETE" }),
  listProxmoxNodes: (clusterId: string) => request<any[]>(`/proxmox/clusters/${clusterId}/nodes`),
  listProxmoxVMs: (clusterId: string, search?: string) => request<any[]>(`/proxmox/clusters/${clusterId}/vms${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  getProxmoxVM: (clusterId: string, vmid: number) => request<any>(`/proxmox/clusters/${clusterId}/vms/${vmid}`),
  listProxmoxContainers: (clusterId: string, search?: string) => request<any[]>(`/proxmox/clusters/${clusterId}/containers${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  listProxmoxStorage: (clusterId: string) => request<any[]>(`/proxmox/clusters/${clusterId}/storage`),
  listProxmoxTasks: (clusterId: string, limit = 100) => request<any[]>(`/proxmox/clusters/${clusterId}/tasks?limit=${limit}`),
  getProxmoxClusterStats: (clusterId: string) => request<any>(`/proxmox/clusters/${clusterId}/stats`),
};
