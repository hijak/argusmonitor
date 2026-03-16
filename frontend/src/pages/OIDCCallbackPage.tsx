import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function OIDCCallbackPage() {
  const { completeOidcLogin } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) {
      setError("Missing OIDC callback parameters");
      return;
    }
    completeOidcLogin(code, state)
      .then(() => navigate("/", { replace: true }))
      .catch((err: any) => setError(err.message || "OIDC sign-in failed"));
  }, [params, completeOidcLogin, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center space-y-3">
        {error ? (
          <>
            <div className="text-sm font-medium text-destructive">OIDC sign-in failed</div>
            <div className="text-sm text-muted-foreground">{error}</div>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
            <div className="text-sm text-muted-foreground">Completing sign-in…</div>
          </>
        )}
      </div>
    </div>
  );
}
