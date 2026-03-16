import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function SAMLCallbackPage() {
  const { completeSamlLogin } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    const saml = params.get("SAMLResponse");
    const relay = params.get("RelayState");
    if (!saml || !relay) {
      setError("Missing SAML callback parameters");
      return;
    }
    completeSamlLogin(saml, relay)
      .then(() => navigate("/", { replace: true }))
      .catch((err: any) => setError(err.message || "SAML sign-in failed"));
  }, [params, completeSamlLogin, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center space-y-3">
        {error ? (
          <>
            <div className="text-sm font-medium text-destructive">SAML sign-in failed</div>
            <div className="text-sm text-muted-foreground">{error}</div>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
            <div className="text-sm text-muted-foreground">Completing SAML sign-in…</div>
          </>
        )}
      </div>
    </div>
  );
}
