import { useState } from "react";
import { motion } from "framer-motion";
import { AtSignIcon, Fingerprint, LockKeyhole, Loader2, ShieldCheck, User2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { AuthDivider } from "@/components/auth-divider";
import { FlickeringGrid } from "@/components/ui/flickering-grid";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

const OidcIcon = (props: React.ComponentProps<"svg">) => (
  <svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
    <g>
      <path d="M12.479,14.265v-3.279h11.049c0.108,0.571,0.164,1.247,0.164,1.979c0,2.46-0.672,5.502-2.84,7.669   C18.744,22.829,16.051,24,12.483,24C5.869,24,0.308,18.613,0.308,12S5.869,0,12.483,0c3.659,0,6.265,1.436,8.223,3.307L18.392,5.62   c-1.404-1.317-3.307-2.341-5.913-2.341C7.65,3.279,3.873,7.171,3.873,12s3.777,8.721,8.606,8.721c3.132,0,4.916-1.258,6.059-2.401   c0.927-0.927,1.537-2.251,1.777-4.059L12.479,14.265z" />
    </g>
  </svg>
);

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
    <div className="relative grid h-screen grid-cols-1 overflow-hidden bg-background md:grid-cols-2 lg:grid-cols-3">
      <div className="flex size-full items-center px-8 md:border-r lg:col-span-2">
        <motion.div
          className="mx-auto flex flex-col items-center justify-center gap-6 sm:w-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex flex-col space-y-1 text-center">
            <h1 className="text-2xl font-semibold">{isRegister ? "Create your account" : "Sign in to Vordr"}</h1>
            <p className="text-sm text-muted-foreground">
              {isRegister
                ? "Create your account to get started."
                : "Sign in to your control plane to continue."}
            </p>
          </div>

          {!isRegister && (
            <div className="w-full space-y-2">
              <Button className="w-full" size="lg" variant="outline" type="button" disabled={loading} onClick={handleOidc}>
                {loading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Fingerprint data-icon="inline-start" />}
                Continue with OIDC
              </Button>
              <Button className="w-full" size="lg" variant="outline" type="button" disabled={loading} onClick={handleSaml}>
                {loading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <ShieldCheck data-icon="inline-start" />}
                Continue with SAML
              </Button>

              <InputGroup>
                <InputGroupInput
                  placeholder="Workspace slug"
                  type="text"
                  value={workspaceSlug}
                  onChange={(e) => setWorkspaceSlug(e.target.value)}
                />
              </InputGroup>

              <AuthDivider>OR CONTINUE WITH EMAIL</AuthDivider>
            </div>
          )}

          <form className="w-full space-y-2" onSubmit={handleSubmit}>
            {isRegister && (
              <InputGroup>
                <InputGroupInput
                  placeholder="Enter your name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={isRegister}
                />
                <InputGroupAddon align="inline-start">
                  <User2 />
                </InputGroupAddon>
              </InputGroup>
            )}

            <InputGroup>
              <InputGroupInput
                placeholder="Enter your email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <InputGroupAddon align="inline-start">
                <AtSignIcon />
              </InputGroupAddon>
            </InputGroup>

            <InputGroup>
              <InputGroupInput
                placeholder={isRegister ? "Create a password" : "Enter your password"}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <InputGroupAddon align="inline-start">
                <LockKeyhole />
              </InputGroupAddon>
            </InputGroup>

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button className="w-full" type="submit" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />}
              {isRegister ? "Create Account" : "Continue With Email"}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground">
            {isRegister ? "Already have an account?" : "Don’t have an account?"}{" "}
            <button
              type="button"
              className="underline underline-offset-4 hover:text-primary"
              onClick={() => {
                setIsRegister((value) => !value);
                setError("");
              }}
            >
              {isRegister ? "Sign in" : "Create one"}
            </button>
          </p>

          <p className="text-center text-xs text-muted-foreground/70">
            Demo: admin@vordr.systems / admin123
          </p>
        </motion.div>
      </div>

      <div className="relative hidden size-full md:flex">
        <div
          aria-hidden={true}
          className="absolute inset-0 blur-md dark:bg-[radial-gradient(50%_80%_at_50%_-10%,hsl(var(--foreground)/0.08),transparent)]"
        />
        <FlickeringGrid
          className="mask-x-from-75% mask-b-to-96% absolute inset-0 z-0"
          color="#666666"
          flickerChance={0.5}
          gridGap={6}
          maxOpacity={0.6}
          squareSize={2}
        />
      </div>
    </div>
  );
}
