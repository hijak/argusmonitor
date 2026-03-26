import { ExternalLink, FileCode2, Github, GitPullRequest, Layers3, Shield, Tag, X } from "lucide-react";
import type { Plugin } from "@/pages/Index";

interface PluginModalProps {
  plugin: Plugin;
  onClose: () => void;
}

export function PluginModal({ plugin, onClose }: PluginModalProps) {
  const Icon = plugin.icon;
  const isProfile = plugin.kind === "profile";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 animate-fade-in bg-background/80 backdrop-blur-sm" />

      <div
        className="relative max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-card shadow-2xl opacity-0 animate-fade-up"
        style={{ animationDelay: "50ms" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="border-b border-border p-6 pb-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1 pr-8">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h2 className="truncate text-lg font-bold text-card-foreground">{plugin.name}</h2>
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium ${
                  isProfile ? "bg-amber-500/10 text-amber-300" : "bg-primary/10 text-primary"
                }`}>
                  {isProfile ? <Layers3 className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                  {isProfile ? "Profile" : "Technology"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {plugin.category} · {plugin.family} · {plugin.integration} integration · {plugin.maturity}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
            <span>
              Version <span className="font-mono text-card-foreground">v{plugin.version}</span>
            </span>
            <span>
              Author <span className="font-medium text-card-foreground">{plugin.author}</span>
            </span>
            <span>
              Status <span className="font-medium text-card-foreground">{plugin.status}</span>
            </span>
            <span>
              Service type <span className="font-mono text-card-foreground">{plugin.serviceType}</span>
            </span>
          </div>
        </div>

        <div className="p-6 pb-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">About</h3>
          <p className="text-sm leading-relaxed text-card-foreground">{plugin.description}</p>
        </div>

        <div className="px-6 pb-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">What it does</h3>
          <div className="space-y-2">
            {plugin.summary.map((item) => (
              <div key={item} className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-card-foreground">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 px-6 pb-4 md:grid-cols-2">
          <div className="rounded-md border border-border bg-muted/30 p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Discovery</h3>
            <div className="flex flex-wrap gap-1.5">
              {plugin.discovery.methods.map((method) => (
                <span key={method} className="rounded-full border border-border bg-background px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                  {method}
                </span>
              ))}
            </div>
            {plugin.discovery.target && (
              <p className="mt-3 text-sm text-card-foreground">Target: {plugin.discovery.target}</p>
            )}
            {plugin.discovery.promotedFrom?.length ? (
              <p className="mt-2 text-xs text-muted-foreground">Promoted from: {plugin.discovery.promotedFrom.join(", ")}</p>
            ) : null}
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Kind</h3>
            <p className="text-sm text-card-foreground">
              {isProfile
                ? "Profile overlay used for stack rollups, dashboard tuning, and optional alert presets."
                : "Technology-first collector intended to represent a real monitored product or runtime."}
            </p>
          </div>
        </div>

        {plugin.profiles?.length ? (
          <div className="px-6 pb-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Optional profiles</h3>
            <div className="space-y-2">
              {plugin.profiles.map((profile) => (
                <div key={profile.id} className="rounded-md border border-border bg-muted/30 px-3 py-3">
                  <div className="text-sm font-medium text-card-foreground">{profile.name}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{profile.description}</div>
                  {profile.whenToSuggest?.length ? (
                    <div className="mt-2 text-xs text-muted-foreground">Suggest when: {profile.whenToSuggest.join(" · ")}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {plugin.appliesTo ? (
          <div className="px-6 pb-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Applies to</h3>
            <div className="rounded-md border border-border bg-muted/30 px-3 py-3 text-sm text-card-foreground">
              {plugin.appliesTo.pluginIds?.length ? <div>Plugins: {plugin.appliesTo.pluginIds.join(", ")}</div> : null}
              {plugin.appliesTo.serviceTypes?.length ? <div>Service types: {plugin.appliesTo.serviceTypes.join(", ")}</div> : null}
              {plugin.appliesTo.families?.length ? <div>Families: {plugin.appliesTo.families.join(", ")}</div> : null}
            </div>
          </div>
        ) : null}

        <div className="px-6 pb-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Config</h3>
          <div className="overflow-hidden rounded-md border border-border bg-muted/60">
            <div className="flex items-center gap-2 border-b border-border bg-muted/80 px-3 py-2">
              <FileCode2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-mono text-muted-foreground">plugin config / env</span>
            </div>
            <pre className="overflow-x-auto p-3 text-xs leading-relaxed text-card-foreground">{JSON.stringify(plugin.config, null, 2)}</pre>
          </div>
        </div>

        <div className="px-6 pb-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tags</h3>
          <div className="flex flex-wrap gap-1.5">
            {plugin.tags.map((tag) => (
              <span key={tag} className="flex items-center gap-1 rounded-sm bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
                <Tag className="h-2.5 w-2.5" />
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="px-6 pb-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Source</h3>
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
            <div className="font-mono text-card-foreground">{plugin.sourcePath}</div>
            <div className="mt-1 text-muted-foreground">Official collector source lives in the dedicated Vordr plugins repository.</div>
          </div>
        </div>

        <div className="flex flex-col gap-3 p-6 pt-2 sm:flex-row">
          <a
            href={`${plugin.repoUrl}/tree/main/${plugin.sourcePath}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.97]"
          >
            <Github className="h-4 w-4" />
            View source
          </a>
          <a
            href={`${plugin.repoUrl}/pulls`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-border bg-muted px-5 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-accent active:scale-[0.97]"
          >
            <GitPullRequest className="h-4 w-4" />
            Submit improvement PR
          </a>
          <a
            href={plugin.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-accent active:scale-[0.97]"
          >
            Repo <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
