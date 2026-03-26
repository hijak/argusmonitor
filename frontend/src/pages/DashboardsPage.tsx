import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BarChart3,
  Bot,
  Boxes,
  Clock,
  LayoutDashboard,
  Plus,
  Server,
  Sparkles,
  Workflow,
} from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const item = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.15 } } };

const categoryMeta: Record<string, { label: string; icon: any }> = {
  technology: { label: "Technology dashboards", icon: Boxes },
  profiles: { label: "Profile overlays", icon: Sparkles },
  "service-group": { label: "Service families", icon: Workflow },
  "service-type": { label: "Service-type templates", icon: Workflow },
  core: { label: "Core dashboards", icon: LayoutDashboard },
  operations: { label: "Operations", icon: Server },
  synthetics: { label: "Synthetics", icon: Workflow },
  reporting: { label: "Reporting", icon: BarChart3 },
};

function prettyType(value?: string | null) {
  if (!value) return "";
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function DashboardsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [filter, setFilter] = useState("all");

  const { data: dashboards = [] } = useQuery({
    queryKey: ["dashboards"],
    queryFn: api.listDashboards,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["dashboard-templates"],
    queryFn: api.listDashboardTemplates,
  });

  const createDashboardMutation = useMutation({
    mutationFn: (data: { name: string; type: string; config: any }) => api.createDashboard(data),
    onSuccess: (dashboard) => {
      toast.success(`Created ${dashboard.name}`);
      queryClient.invalidateQueries({ queryKey: ["dashboards"] });
      navigate(`/dashboards/${dashboard.id}`);
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create dashboard"),
  });

  const createFromTemplate = (template: any) => {
    const config = {
      preset: template.preset || template.name,
      template_id: template.id,
      plugin_id: template.plugin_id || undefined,
      service_type: template.service_type || undefined,
      service_group: template.service_group || undefined,
      profile: template.profile || undefined,
      widget_count: template.widget_count,
    };
    createDashboardMutation.mutate({
      name: template.name,
      type: template.category === "technology" || template.category === "service-type" ? "system" : "custom",
      config,
    });
  };

  const handleGenerate = () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    createDashboardMutation.mutate({
      name: trimmed.length > 48 ? `${trimmed.slice(0, 45)}...` : trimmed,
      type: "ai",
      config: { preset: trimmed, prompt: trimmed, widget_count: 6 },
    });
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} min ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  const filteredTemplates = useMemo(() => {
    return templates.filter((template: any) => filter === "all" || template.category === filter);
  }, [templates, filter]);

  const recommendedTemplates = useMemo(() => {
    return filteredTemplates.filter((template: any) => template.recommended).slice(0, 6);
  }, [filteredTemplates]);

  const groupedTemplates = useMemo(() => {
    return filteredTemplates.reduce((acc: Record<string, any[]>, template: any) => {
      const key = template.category || "other";
      acc[key] = acc[key] || [];
      acc[key].push(template);
      return acc;
    }, {});
  }, [filteredTemplates]);

  const filterOptions = useMemo(() => {
    const values = Array.from(new Set((templates || []).map((template: any) => template.category).filter(Boolean)));
    return ["all", ...values];
  }, [templates]);

  return (
    <motion.div className="p-6 space-y-6" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}>
        <PageHeader
          title="Dashboards"
          description="Prefab, plugin-aware dashboards for the things you actually run — plus custom and AI-generated boards."
        >
          <button
            onClick={() => {
              const firstTemplate = templates[0];
              if (firstTemplate) createFromTemplate(firstTemplate);
            }}
            disabled={createDashboardMutation.isPending || !templates.length}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {createDashboardMutation.isPending ? "Creating..." : "New dashboard"}
          </button>
        </PageHeader>
      </motion.div>

      <motion.div variants={item}>
        <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
              <div className="space-y-3 flex-1">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Template-first dashboards</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Dashboards are now organised around detected technologies and optional profile overlays, so PostgreSQL gets PostgreSQL boards, Redis gets Redis boards, and stack-style rollups stay clearly marked as profiles.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border border-border bg-background px-2.5 py-1">{templates.length} templates</span>
                  <span className="rounded-full border border-border bg-background px-2.5 py-1">{templates.filter((t: any) => t.category === "technology").length} technology-aware</span>
                  <span className="rounded-full border border-border bg-background px-2.5 py-1">{templates.filter((t: any) => t.recommended).length} recommended now</span>
                  <span className="rounded-full border border-border bg-background px-2.5 py-1">{dashboards.length} saved dashboards</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
              <Bot className="h-5 w-5 text-primary" />
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                placeholder="Describe a dashboard… e.g. 'Redis saturation and latency for production'"
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <button
              onClick={handleGenerate}
              disabled={createDashboardMutation.isPending || !prompt.trim()}
              className="mt-3 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Generate with AI
            </button>
          </div>
        </div>
      </motion.div>

      <motion.div variants={item} className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {filterOptions.map((option) => (
            <button
              key={option}
              onClick={() => setFilter(option)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === option
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {option === "all" ? "All templates" : categoryMeta[option]?.label || prettyType(option)}
            </button>
          ))}
        </div>

        {recommendedTemplates.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Recommended right now</h2>
              <span className="text-xs text-muted-foreground">{recommendedTemplates.length}</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {recommendedTemplates.map((template: any) => (
                <button
                  key={`recommended-${template.id}`}
                  onClick={() => createFromTemplate(template)}
                  className="rounded-2xl border border-primary/30 bg-primary/5 p-5 text-left transition-colors hover:border-primary/50 hover:bg-primary/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground">{template.name}</h3>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Recommended</span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{template.description}</p>
                    </div>
                    <LayoutDashboard className="h-4 w-4 shrink-0 text-primary" />
                  </div>
                  {template.recommendation_reason ? (
                    <div className="mt-3 rounded-lg border border-primary/20 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                      {template.recommendation_reason}
                    </div>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    <span className="rounded-full border border-border bg-background px-2 py-1">{template.widget_count} widgets</span>
                    {template.available_count ? <span className="rounded-full border border-border bg-background px-2 py-1">{template.available_count} matching</span> : null}
                    {template.verified_count ? <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-300">{template.verified_count} verified</span> : null}
                    {template.suspected_count ? <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-300">{template.suspected_count} suspected</span> : null}
                    {template.hinted_count ? <span className="rounded-full bg-sky-500/10 px-2 py-1 text-sky-300">{template.hinted_count} hinted</span> : null}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="space-y-6">
          {Object.entries(groupedTemplates).map(([category, items]) => {
            const meta = categoryMeta[category] || { label: prettyType(category), icon: LayoutDashboard };
            const Icon = meta.icon;
            return (
              <section key={category} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">{meta.label}</h2>
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map((template: any) => (
                    <button
                      key={template.id}
                      onClick={() => createFromTemplate(template)}
                      className="rounded-2xl border border-border bg-card p-5 text-left transition-colors hover:border-primary/30 hover:bg-surface-hover"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-foreground">{template.name}</h3>
                            {template.recommended && (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Recommended</span>
                            )}
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">{template.description}</p>
                        </div>
                        <LayoutDashboard className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        <span className="rounded-full border border-border bg-background px-2 py-1">{template.widget_count} widgets</span>
                        {template.available_count ? (
                          <span className="rounded-full border border-border bg-background px-2 py-1">{template.available_count} matching services</span>
                        ) : null}
                        {template.verified_count ? (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-300">{template.verified_count} verified</span>
                        ) : null}
                        {template.suspected_count ? (
                          <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-300">{template.suspected_count} suspected</span>
                        ) : null}
                        {template.hinted_count ? (
                          <span className="rounded-full bg-sky-500/10 px-2 py-1 text-sky-300">{template.hinted_count} hinted</span>
                        ) : null}
                        {template.category === "technology" && template.plugin_id ? (
                          <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">tech:{template.plugin_id}</span>
                        ) : null}
                        {template.category === "profiles" && template.profile ? (
                          <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-300">profile:{prettyType(template.profile)}</span>
                        ) : null}
                        {!template.plugin_id && template.service_type ? (
                          <span className="rounded-full bg-muted px-2 py-1">{prettyType(template.service_type)}</span>
                        ) : null}
                        {!template.plugin_id && !template.service_type && template.service_group ? (
                          <span className="rounded-full bg-muted px-2 py-1">{prettyType(template.service_group)}</span>
                        ) : null}
                        {!template.plugin_id && !template.service_type && !template.service_group && template.profile ? (
                          <span className="rounded-full bg-muted px-2 py-1">{prettyType(template.profile)}</span>
                        ) : null}
                      </div>
                      {template.recommendation_reason ? (
                        <p className="mt-3 text-xs text-muted-foreground">{template.recommendation_reason}</p>
                      ) : null}
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </motion.div>

      <motion.div variants={item} className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Saved dashboards</h2>
          <span className="text-xs text-muted-foreground">{dashboards.length}</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dashboards.map((db: any) => (
            <div
              key={db.id}
              onClick={() => navigate(`/dashboards/${db.id}`)}
              className="cursor-pointer rounded-2xl border border-border bg-card p-5 transition-colors hover:bg-surface-hover group"
            >
              <div className="mb-3 flex items-center justify-between">
                <LayoutDashboard className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
                {db.type === "ai" && (
                  <span className="flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    <Bot className="h-2.5 w-2.5" /> AI
                  </span>
                )}
                {db.type === "system" && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">System</span>
                )}
              </div>
              <h3 className="mb-1 text-sm font-medium">{db.name}</h3>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><BarChart3 className="h-3 w-3" />{db.widgets_count} widgets</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeAgo(db.updated_at)}</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-6 rounded-sm bg-muted/50 transition-colors group-hover:bg-primary/10" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
