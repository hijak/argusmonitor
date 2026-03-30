import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface AppMeta {
  app_name: string;
  demo_mode: boolean;
  edition: {
    profile: "self_hosted" | "cloud" | "enterprise" | string;
    label: string;
    is_managed: boolean;
    is_enterprise: boolean;
  };
  capabilities: Record<string, boolean>;
}

const AppMetaContext = createContext<{ meta: AppMeta | null; isLoading: boolean }>({ meta: null, isLoading: true });

export function AppMetaProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useQuery({ queryKey: ["app-meta"], queryFn: api.getMeta, staleTime: 60_000 });
  return <AppMetaContext.Provider value={{ meta: data ?? null, isLoading }}>{children}</AppMetaContext.Provider>;
}

export function useAppMeta() {
  return useContext(AppMetaContext);
}
