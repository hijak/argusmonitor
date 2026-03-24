import { useMemo, useState } from "react";
import {
  Bell,
  GitPullRequest,
  Globe,
  Network,
  Search,
  Shield,
} from "lucide-react";
import { PluginCard } from "@/components/PluginCard";
import { CategoryFilter } from "@/components/CategoryFilter";
import { HeroSection } from "@/components/HeroSection";
import { PluginModal } from "@/components/PluginModal";
import { generatedPlugins } from "@/generated/plugins.generated";
import { iconMap } from "@/lib/icons";

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

const REPO_URL = "https://github.com/hijak/vordr-plugins";

const plugins: Plugin[] = generatedPlugins.map((plugin) => ({
  ...plugin,
  icon: iconMap[plugin.iconKey] || Network,
}));

const categories = ["All", ...Array.from(new Set(plugins.map((plugin) => plugin.category)))];

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
                Official collectors now live in a separate plugins repo. The hub builds its catalogue from plugin manifests,
                while the main Vordr UI keeps a standard presentation layer for plugin-backed services.
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
                Browse plugins repo
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
            Vordr plugin directory · official collector manifests are sourced from the separate plugins repo.
          </p>
          <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">Repository</a>
            <a href={`${REPO_URL}/pulls`} target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">Open a PR</a>
            <a href={`${REPO_URL}/tree/main/manifests`} target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">Plugin manifests</a>
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
