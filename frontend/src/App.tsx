import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppMetaProvider } from "@/contexts/AppMetaContext";
import { AppLayout } from "@/components/AppLayout";
import { Activity } from "lucide-react";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const OIDCCallbackPage = lazy(() => import("./pages/OIDCCallbackPage"));
const SAMLCallbackPage = lazy(() => import("./pages/SAMLCallbackPage"));
const OverviewPage = lazy(() => import("./pages/OverviewPage"));
const InfrastructurePage = lazy(() => import("./pages/InfrastructurePage"));
const ServicesPage = lazy(() => import("./pages/ServicesPage"));
const TransactionsPage = lazy(() => import("./pages/TransactionsPage"));
const KubernetesPage = lazy(() => import("./pages/KubernetesPage"));
const SwarmPage = lazy(() => import("./pages/SwarmPage"));
const ProxmoxPage = lazy(() => import("./pages/ProxmoxPage"));
const AlertsPage = lazy(() => import("./pages/AlertsPage"));
const IncidentsPage = lazy(() => import("./pages/IncidentsPage"));
const DashboardsPage = lazy(() => import("./pages/DashboardsPage"));
const DashboardViewPage = lazy(() => import("./pages/DashboardViewPage"));
const LogsPage = lazy(() => import("./pages/LogsPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const AIAssistantPage = lazy(() => import("./pages/AIAssistantPage"));
const OnCallPage = lazy(() => import("./pages/OnCallPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const EnterprisePage = lazy(() => import("./pages/EnterprisePage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
});

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary animate-pulse">
          <Activity className="h-6 w-6 text-primary-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">Loading Vordr...</p>
      </div>
    </div>
  );
}

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Activity className="h-4 w-4 animate-pulse text-primary" />
        </div>
        Loading page...
      </div>
    </div>
  );
}

function AuthenticatedRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <AppLayout>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/infrastructure" element={<InfrastructurePage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/kubernetes" element={<KubernetesPage />} />
          <Route path="/swarm" element={<SwarmPage />} />
          <Route path="/proxmox" element={<ProxmoxPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/incidents" element={<IncidentsPage />} />
          <Route path="/dashboards" element={<DashboardsPage />} />
          <Route path="/dashboards/:id" element={<DashboardViewPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/ai" element={<AIAssistantPage />} />
          <Route path="/oncall" element={<OnCallPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/enterprise" element={<EnterprisePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </AppLayout>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/login/oidc/callback" element={<OIDCCallbackPage />} />
        <Route path="/login/saml/callback" element={<SAMLCallbackPage />} />
        <Route path="/*" element={<AuthenticatedRoutes />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppMetaProvider>
            <AppRoutes />
          </AppMetaProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
