import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { User, Bell, Shield, Plug, Palette, Globe, ChevronRight, LogOut } from "lucide-react";
import { motion } from "framer-motion";

const sections = [
  { label: "Profile", description: "Manage your account and preferences", icon: User },
  { label: "Notifications", description: "Configure alert channels and routing", icon: Bell },
  { label: "Security", description: "API keys, SSO, and access control", icon: Shield },
  { label: "Integrations", description: "Connect Slack, PagerDuty, webhooks", icon: Plug },
  { label: "Appearance", description: "Theme and display preferences", icon: Palette },
  { label: "Agents", description: "Manage monitoring agents and endpoints", icon: Globe },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const item = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.15 } } };

export default function SettingsPage() {
  const { user, logout } = useAuth();

  return (
    <motion.div className="p-6 space-y-6 max-w-2xl" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}>
        <PageHeader title="Settings" description="Manage your ArgusMonitor configuration" />
      </motion.div>

      {user && (
        <motion.div variants={item} className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground capitalize">{user.role}</span>
          </div>
        </motion.div>
      )}

      <motion.div variants={item} className="rounded-lg border border-border bg-card divide-y divide-border">
        {sections.map(s => (
          <button key={s.label} className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-hover">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <s.icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{s.label}</p>
              <p className="text-xs text-muted-foreground">{s.description}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </motion.div>

      <motion.div variants={item}>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg border border-critical/30 bg-critical/5 px-5 py-3 text-sm text-critical transition-colors hover:bg-critical/10"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </motion.div>
    </motion.div>
  );
}
