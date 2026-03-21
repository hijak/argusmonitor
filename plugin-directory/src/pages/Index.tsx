import { useMemo, useState } from "react";
import {
  Activity,
  Bell,
  Database,
  GitPullRequest,
  Globe,
  HardDrive,
  Network,
  Rabbit,
  Search,
  Server,
  Shield,
  Workflow,
} from "lucide-react";
import { PluginCard } from "@/components/PluginCard";
import { CategoryFilter } from "@/components/CategoryFilter";
import { HeroSection } from "@/components/HeroSection";
import { PluginModal } from "@/components/PluginModal";

export interface Plugin {
  id: string;
  name: string;
  description: string;
  author: string;
  category: string;
  downloads: number;
  rating: number;
  version: string;
  icon: React.ElementType;
  verified: boolean;
  tags: string[];
  repoUrl: string;
  sourcePath: string;
  status: "official" | "experimental";
  maturity: "alpha" | "beta" | "stable";
  integration: "agent" | "backend" | "ui" | "hybrid";
  summary: string[];
  config: Record<string, string | boolean | number>;
}

const REPO_URL = "https://github.com/hijak/vordr";

const plugins: Plugin[] = [
  {
    id: "postgres",
    name: "PostgreSQL Collector",
    description: "SQL-backed PostgreSQL discovery and health collection with connection counts, database totals, transaction stats, and replication lag.",
    author: "Argus Core",
    category: "Database",
    downloads: 0,
    rating: 5,
    version: "0.1.0",
    icon: Database,
    verified: true,
    tags: ["postgres", "sql", "replication", "connections"],
    repoUrl: REPO_URL,
    sourcePath: "agent/vordr_agent/plugins/postgres.py",
    status: "official",
    maturity: "stable",
    integration: "agent",
    summary: [
      "Discovers PostgreSQL on the host and upgrades to live SQL-backed metrics when VORDR_POSTGRES_DSN is set.",
      "Surfaces active/idle/total connections, database count, transaction counters, and replication lag.",
      "Feeds the Services page and service detail sheet with plugin metadata.",
    ],
    config: {
      VORDR_POSTGRES_DSN: "postgresql://argus:arguspass@127.0.0.1:5432/appdb",
      VORDR_POSTGRES_METRICS_URL: "optional",
      integration: "agent",
    },
  },
  {
    id: "mysql",
    name: "MySQL Collector",
    description: "SQL-backed MySQL and MariaDB collector with thread stats, slow query visibility, bytes in/out, and connection utilization.",
    author: "Argus Core",
    category: "Database",
    downloads: 0,
    rating: 5,
    version: "0.1.0",
    icon: Server,
    verified: true,
    tags: ["mysql", "mariadb", "sql", "threads"],
    repoUrl: REPO_URL,
    sourcePath: "agent/vordr_agent/plugins/mysql.py",
    status: "official",
    maturity: "stable",
    integration: "agent",
    summary: [
      "Connects via VORDR_MYSQL_DSN for richer live metrics instead of port-only guessing.",
      "Collects running/connected threads, slow queries, questions, bytes sent/received, and max connection utilization.",
      "Works against the argus-lab VM and now has the MySQL 8 auth deps sorted.",
    ],
    config: {
      VORDR_MYSQL_DSN: "mysql://argus:arguspass@127.0.0.1:3306/appdb",
      integration: "agent",
    },
  },
  {
    id: "redis",
    name: "Redis Collector",
    description: "Redis INFO-backed collector for role, client count, memory usage, key counts, command totals, and ops/sec.",
    author: "Argus Core",
    category: "Cache",
    downloads: 0,
    rating: 5,
    version: "0.1.0",
    icon: HardDrive,
    verified: true,
    tags: ["redis", "info", "memory", "ops"],
    repoUrl: REPO_URL,
    sourcePath: "agent/vordr_agent/plugins/redis.py",
    status: "official",
    maturity: "stable",
    integration: "agent",
    summary: [
      "Promotes simple TCP discovery into real Redis INFO collection when VORDR_REDIS_URL is configured.",
      "Tracks role, used memory, connected clients, keys, hit rate, commands processed, and instantaneous ops/sec.",
      "Shows plugin health badges such as info live or collector issue directly in the Services page.",
    ],
    config: {
      VORDR_REDIS_URL: "redis://127.0.0.1:6379/0",
      integration: "agent",
    },
  },
  {
    id: "rabbitmq",
    name: "RabbitMQ Collector",
    description: "RabbitMQ management API collector for queue counts, backlog, rates, consumers, listeners, and cluster-level health.",
    author: "Argus Core",
    category: "Messaging",
    downloads: 0,
    rating: 5,
    version: "0.1.0",
    icon: Rabbit,
    verified: true,
    tags: ["rabbitmq", "queues", "backlog", "management-api"],
    repoUrl: REPO_URL,
    sourcePath: "agent/vordr_agent/plugins/rabbitmq.py",
    status: "official",
    maturity: "stable",
    integration: "agent",
    summary: [
      "Uses VORDR_RABBITMQ_API_URL with optional credentials for live management API-backed stats.",
      "Collects queue totals, backlog, rates, channels, consumers, listeners, and cluster identity.",
      "Feeds plugin health badges like api live and backlog into the Services UI.",
    ],
    config: {
      VORDR_RABBITMQ_API_URL: "http://127.0.0.1:15672",
      VORDR_RABBITMQ_API_USERNAME: "argus",
      VORDR_RABBITMQ_API_PASSWORD: "arguspass",
      integration: "agent",
    },
  },
  {
    id: "host-metrics-ui",
    name: "Host Telemetry Panels",
    description: "UI-side host telemetry experience with live CPU, memory, disk, bandwidth charts, and per-interface panels.",
    author: "Argus Core",
    category: "UI",
    downloads: 0,
    rating: 5,
    version: "0.1.0",
    icon: Activity,
    verified: true,
    tags: ["host", "bandwidth", "charts", "interfaces"],
    repoUrl: REPO_URL,
    sourcePath: "frontend/src/components/HostDetailModal.tsx",
    status: "official",
    maturity: "beta",
    integration: "hybrid",
    summary: [
      "Renders node detail panels with historical CPU, memory, disk, and RX/TX bandwidth charts.",
      "Uses the corrected /api/hosts/{id}/metrics/stream path for live updates.",
      "Pairs with host metric interface payloads from the backend to show interface throughput snapshots.",
    ],
    config: {
      backendRoute: "/api/hosts/{host_id}/metrics",
      liveStream: "/api/hosts/{host_id}/metrics/stream",
      integration: "hybrid",
    },
  },
  {
    id: "services-ui",
    name: "Services Directory UI",
    description: "Grouped services experience with node sections, plugin health badges, richer service tiles, and detailed service sheets.",
    author: "Argus Core",
    category: "UI",
    downloads: 0,
    rating: 5,
    version: "0.1.0",
    icon: Workflow,
    verified: true,
    tags: ["services", "cards", "plugin-health", "mobile"],
    repoUrl: REPO_URL,
    sourcePath: "frontend/src/pages/ServicesPage.tsx",
    status: "official",
    maturity: "beta",
    integration: "hybrid",
    summary: [
      "Groups services by node, exposes collector health at a glance, and opens detailed service sheets on click.",
      "Optimised to hold up better on mobile instead of turning into cramped dashboard soup.",
      "Built on top of service plugin metadata stored and synced through the monolith backend.",
    ],
    config: {
      page: "/services",
      detailSheet: "frontend/src/components/ServiceDetailSheet.tsx",
      integration: "hybrid",
    },
  },
];

const categories = ["All", "Database", "Cache", "Messaging", "UI"];

const Index = () => {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);

  const filtered = useMemo(() => {
    return plugins.filter((plugin) => {
      const q = search.toLowerCase();
      const matchesSearch =
        plugin.name.toLowerCase().includes(q) ||
        plugin.description.toLowerCase().includes(q) ||
        plugin.tags.some((tag) => tag.toLowerCase().includes(q)) ||
        plugin.sourcePath.toLowerCase().includes(q);
      const matchesCategory = activeCategory === "All" || plugin.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [search, activeCategory]);

  const totals = {
    official: plugins.filter((plugin) => plugin.status === "official").length,
    verified: plugins.filter((plugin) => plugin.verified).length,
    integrations: new Set(plugins.map((plugin) => plugin.integration)).size,
  };

  return (
    <div className="min-h-screen bg-background">
      <HeroSection />

      <div className="container relative z-10 mx-auto -mt-8 max-w-6xl px-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-lg sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search official plugins by name, tag, path, or capability..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-input bg-background py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs sm:text-sm">
              <StatChip label="Official" value={totals.official} icon={Shield} />
              <StatChip label="Verified" value={totals.verified} icon={Bell} />
              <StatChip label="Modes" value={totals.integrations} icon={Globe} />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto mt-6 max-w-6xl px-4">
        <CategoryFilter categories={categories} active={activeCategory} onChange={setActiveCategory} />
      </div>

      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 rounded-2xl border border-border bg-card/60 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">Official plugin directory</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                For now this lives inside the monolith, but the intention is clear: each plugin gets its own home over time.
                New plugins should come in through GitHub PRs, and this directory is the public catalogue of what ships officially.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <a
                href={`${REPO_URL}/pulls`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 font-medium text-foreground hover:bg-accent"
              >
                <GitPullRequest className="h-4 w-4" />
                Submit a plugin PR
              </a>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90"
              >
                <Network className="h-4 w-4" />
                Browse GitHub repo
              </a>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((plugin, i) => (
            <PluginCard key={plugin.id} plugin={plugin} index={i} onClick={() => setSelectedPlugin(plugin)} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="py-20 text-center">
            <Search className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
            <p className="text-lg text-muted-foreground">No official plugins match that search.</p>
            <button
              onClick={() => {
                setSearch("");
                setActiveCategory("All");
              }}
              className="mt-3 text-sm font-medium text-primary hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      <footer className="mt-8 border-t border-border bg-card/50 py-8">
        <div className="container mx-auto flex max-w-6xl flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Vordr plugin directory · official plugins are sourced from the GitHub monolith until they split into their own repos.
          </p>
          <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">Repository</a>
            <a href={`${REPO_URL}/pulls`} target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">Open a PR</a>
            <a href={`${REPO_URL}/tree/main/agent/vordr_agent/plugins`} target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">Plugin source</a>
          </div>
        </div>
      </footer>

      {selectedPlugin && <PluginModal plugin={selectedPlugin} onClose={() => setSelectedPlugin(null)} />}
    </div>
  );
};

function StatChip({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2">
      <div className="flex items-center justify-center gap-1 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-1 text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}

export default Index;
