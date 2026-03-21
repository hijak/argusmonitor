import { ArrowUpRight, Github, Shield, Star } from "lucide-react";
import type { Plugin } from "@/pages/Index";

interface PluginCardProps {
  plugin: Plugin;
  index: number;
  onClick?: () => void;
}

export function PluginCard({ plugin, index, onClick }: PluginCardProps) {
  const Icon = plugin.icon;

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-2xl border border-border bg-card p-5 opacity-0 transition-[box-shadow,transform,border-color] duration-300 ease-out hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg animate-fade-up"
      style={{ animationDelay: `${80 + index * 70}ms`, animationFillMode: "forwards" }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {plugin.verified && (
            <span className="inline-flex items-center gap-1 rounded-sm bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              <Shield className="h-3 w-3" />
              Official
            </span>
          )}
          <span className="rounded-sm bg-muted px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {plugin.maturity}
          </span>
        </div>
      </div>

      <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        <span>{plugin.category}</span>
        <span>•</span>
        <span>{plugin.integration}</span>
      </div>

      <h3 className="mb-1.5 text-[1rem] font-semibold leading-tight text-card-foreground transition-colors group-hover:text-primary">
        {plugin.name}
      </h3>
      <p className="mb-4 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{plugin.description}</p>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {plugin.tags.slice(0, 4).map((tag) => (
          <span key={tag} className="rounded-sm bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
            {tag}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <Metric label="Rating" value={String(plugin.rating)} icon={<Star className="h-3 w-3 text-primary fill-primary" />} />
        <Metric label="Version" value={`v${plugin.version}`} />
        <Metric label="Status" value={plugin.status} />
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <div className="mb-2 text-xs text-muted-foreground">{plugin.sourcePath}</div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">by {plugin.author}</span>
          <div className="flex items-center gap-3 text-xs font-medium text-primary">
            <a
              href={`${plugin.repoUrl}/tree/main/${plugin.sourcePath}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 hover:underline"
            >
              <Github className="h-3.5 w-3.5" />
              Source
            </a>
            <span className="inline-flex items-center gap-1">
              Details <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background px-2.5 py-2">
      <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="truncate font-mono text-foreground">{value}</div>
    </div>
  );
}
