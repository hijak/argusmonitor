import { Server, Cloud, Cog, Bot, ShieldCheck, Zap, Building2, ScrollText, KeyRound } from "lucide-react";

const items = [
  { icon: Server, label: "Self-host friendly" },
  { icon: Cloud, label: "Hosted option available" },
  { icon: Cog, label: "Systemd-native agents" },
  { icon: Bot, label: "AI with infra context" },
  { icon: Building2, label: "Workspace foundations" },
  { icon: KeyRound, label: "OIDC / RBAC groundwork" },
  { icon: ScrollText, label: "Audit trail" },
  { icon: ShieldCheck, label: "Maintenance & silences" },
  { icon: Zap, label: "Real notification delivery" },
];

const TrustBar = () => (
  <section className="border-y border-border bg-card/30 py-8">
    <div className="container mx-auto px-4 lg:px-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <item.icon className="h-4 w-4 flex-shrink-0 text-primary" />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default TrustBar;
