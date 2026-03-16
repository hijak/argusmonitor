import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppMetaProvider } from "@/contexts/AppMetaContext";
import { AppLayout } from "@/components/AppLayout";
import LoginPage from "./pages/LoginPage";
import OverviewPage from "./pages/OverviewPage";
import InfrastructurePage from "./pages/InfrastructurePage";
import ServicesPage from "./pages/ServicesPage";
import TransactionsPage from "./pages/TransactionsPage";
import AlertsPage from "./pages/AlertsPage";
import IncidentsPage from "./pages/IncidentsPage";
import DashboardsPage from "./pages/DashboardsPage";
import DashboardViewPage from "./pages/DashboardViewPage";
import LogsPage from "./pages/LogsPage";
import ReportsPage from "./pages/ReportsPage";
import AIAssistantPage from "./pages/AIAssistantPage";
import OnCallPage from "./pages/OnCallPage";
import UsersPage from "./pages/UsersPage";
import EnterprisePage from "./pages/EnterprisePage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";
import { Activity } from "lucide-react";

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
        <p className="text-sm text-muted-foreground">Loading ArgusMonitor...</p>
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
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/infrastructure" element={<InfrastructurePage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
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
    </AppLayout>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/*" element={<AuthenticatedRoutes />} />
    </Routes>
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
