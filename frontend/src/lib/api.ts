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
    request<{ access_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string, name: string) =>
    request<{ access_token: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    }),

  me: () => request<{ id: string; email: string; name: string; role: string }>("/auth/me"),

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
  listHosts: (params?: { type?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.type && params.type !== "all") qs.set("type", params.type);
    if (params?.search) qs.set("search", params.search);
    const q = qs.toString();
    return request<any[]>(`/hosts${q ? `?${q}` : ""}`);
  },
  createHost: (data: any) =>
    request<any>("/hosts", { method: "POST", body: JSON.stringify(data) }),
  getHost: (id: string) => request<any>(`/hosts/${id}`),
  getHostMetrics: (id: string) => request<any>(`/hosts/${id}/metrics`),
  deleteHost: (id: string) =>
    request<void>(`/hosts/${id}`, { method: "DELETE" }),

  // Services
  listServices: () => request<any[]>("/services"),
  createService: (data: any) =>
    request<any>("/services", { method: "POST", body: JSON.stringify(data) }),

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
  listTransactionRuns: (id: string) => request<any[]>(`/transactions/${id}/runs`),

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

  // Incidents
  listIncidents: () => request<any[]>("/incidents"),
  createIncident: (data: any) =>
    request<any>("/incidents", { method: "POST", body: JSON.stringify(data) }),
  addIncidentEvent: (id: string, data: any) =>
    request<any>(`/incidents/${id}/events`, { method: "POST", body: JSON.stringify(data) }),

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
  getDashboard: (id: string) => request<any>(`/dashboards/${id}`),
  getDashboardWidgets: (id: string) => request<any[]>(`/dashboards/${id}/widgets`),
  createDashboard: (data: any) =>
    request<any>("/dashboards", { method: "POST", body: JSON.stringify(data) }),

  // AI
  aiChat: (message: string) =>
    request<{ role: string; content: string; timestamp: string }>("/ai/chat", {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
  aiHistory: () => request<any[]>("/ai/history"),
  aiGenerateTransaction: (prompt: string) =>
    request<any>("/ai/generate-transaction", {
      method: "POST",
      body: JSON.stringify({ prompt }),
    }),
  aiExplainFailure: (runId: string) =>
    request<{ explanation: string }>("/ai/explain-failure", {
      method: "POST",
      body: JSON.stringify({ run_id: runId }),
    }),

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
  listAgents: () => request<any[]>("/settings/agents"),
};
