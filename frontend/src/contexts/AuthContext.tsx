import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { api } from "@/lib/api";
import { setWorkspaceId } from "@/lib/workspace";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  timezone: string;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  completeOidcLogin: (code: string, state: string) => Promise<void>;
  completeSamlLogin: (samlResponse: string, relayState: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("argus_token"));
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const me = await api.me();
      setUser(me);
    } catch {
      localStorage.removeItem("argus_token");
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    localStorage.setItem("argus_token", res.access_token);
    if (res.workspace_id) setWorkspaceId(res.workspace_id);
    setToken(res.access_token);
    const me = await api.me();
    setUser(me);
  };

  const register = async (email: string, password: string, name: string) => {
    const res = await api.register(email, password, name);
    localStorage.setItem("argus_token", res.access_token);
    if (res.workspace_id) setWorkspaceId(res.workspace_id);
    setToken(res.access_token);
    const me = await api.me();
    setUser(me);
  };

  const completeOidcLogin = async (code: string, state: string) => {
    const res = await api.oidcCallback(code, state);
    localStorage.setItem("argus_token", res.access_token);
    if (res.workspace_id) setWorkspaceId(res.workspace_id);
    setToken(res.access_token);
    const me = await api.me();
    setUser(me);
  };

  const completeSamlLogin = async (samlResponse: string, relayState: string) => {
    const res = await api.samlAcs(samlResponse, relayState);
    localStorage.setItem("argus_token", res.access_token);
    if (res.workspace_id) setWorkspaceId(res.workspace_id);
    setToken(res.access_token);
    const me = await api.me();
    setUser(me);
  };

  const logout = () => {
    localStorage.removeItem("argus_token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, completeOidcLogin, completeSamlLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
