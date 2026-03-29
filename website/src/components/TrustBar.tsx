import { Server, Cloud, Cog, Bot, ShieldCheck, Zap, Building2, ScrollText, KeyRound } from "lucide-react";

const items = [
  { icon: Server, label: "Open-source self-hosted core" },
  { icon: Cloud, label: "Managed cloud option" },
  { icon: Cog, label: "Systemd-native agents" },
  { icon: Bot, label: "AI with infra context" },
  { icon: Building2, label: "Team and workspace support" },
  { icon: KeyRound, label: "SSO / identity path" },
  { icon: ScrollText, label: "Audit visibility" },
  { icon: ShieldCheck, label: "Governance and silences" },
  { icon: Zap, label: "Real notification delivery" },
];

const TrustBar = () => (
  <section className="border-y border-border bg-card/30 py-8">
    <div className="container mx-auto px-4 lg:px-8">
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
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
