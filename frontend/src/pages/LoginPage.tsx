import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Activity, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function LoginPage() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [workspaceSlug, setWorkspaceSlug] = useState("default");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isRegister) {
        await register(email, password, name);
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleOidc = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await api.oidcStart(workspaceSlug);
      window.location.href = res.authorize_url;
    } catch (err: any) {
      setError(err.message || "OIDC start failed");
      setLoading(false);
    }
  };

  const handleSaml = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await api.samlStart(workspaceSlug);
      window.location.href = `${res.idp_entry_point}?RelayState=${encodeURIComponent(res.relay_state)}&callback=${encodeURIComponent(res.entry_point)}`;
    } catch (err: any) {
      setError(err.message || "SAML start failed");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Activity className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">ArgusMonitor</h1>
          <p className="text-sm text-muted-foreground">
            {isRegister ? "Create your account" : "Sign in to your account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                required={isRegister}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/25"
              />
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@argus.io"
              required
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/25"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="admin123"
              required
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/25"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-critical/10 px-3 py-2 text-sm text-critical">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isRegister ? "Create Account" : "Sign In"}
          </button>

          {!isRegister && (
            <div className="space-y-2 pt-2">
              <input
                type="text"
                value={workspaceSlug}
                onChange={e => setWorkspaceSlug(e.target.value)}
                placeholder="workspace slug"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/25"
              />
              <button
                type="button"
                disabled={loading}
                onClick={handleOidc}
                className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
              >
                Sign in with OIDC
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleSaml}
                className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
              >
                Sign in with SAML
              </button>
            </div>
          )}
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            onClick={() => { setIsRegister(!isRegister); setError(""); }}
            className="text-primary hover:underline"
          >
            {isRegister ? "Sign in" : "Create one"}
          </button>
        </p>

        <p className="mt-4 text-center text-xs text-muted-foreground/60">
          Demo: admin@argus.io / admin123
        </p>
      </motion.div>
    </div>
  );
}
