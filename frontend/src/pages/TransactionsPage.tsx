import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Bot,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Code,
  Eye,
  Globe,
  History,
  Loader2,
  MousePointer,
  Pencil,
  Play,
  Plus,
  Trash2,
  Type,
  XCircle,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const stepIcons: Record<string, typeof Globe> = {
  navigate: Globe,
  input: Type,
  click: MousePointer,
  assert: Eye,
  api: Code,
  wait: Clock,
};

const stepTypeOptions = [
  { value: "navigate", label: "Navigate" },
  { value: "input", label: "Input / Fill" },
  { value: "click", label: "Click" },
  { value: "assert", label: "Assert text" },
  { value: "wait", label: "Wait" },
  { value: "api", label: "API call" },
];

const schedulePresets = [
  { label: "Every 1 min", seconds: 60 },
  { label: "Every 5 min", seconds: 300 },
  { label: "Every 15 min", seconds: 900 },
  { label: "Every 30 min", seconds: 1800 },
  { label: "Every hour", seconds: 3600 },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const item = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.15 } } };

type StepDraft = {
  id?: string;
  order: number;
  type: string;
  label: string;
  config: Record<string, any>;
};

function formatDuration(durationMs?: number | null) {
  if (!durationMs) return "running";
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function formatScheduleLabel(schedule?: string | null, intervalSeconds?: number | null, cronExpression?: string | null) {
  if (cronExpression?.trim()) return `Cron: ${cronExpression.trim()}`;
  if (schedule && schedule.trim()) return schedule;
  if (!intervalSeconds) return "Manual";
  if (intervalSeconds % 3600 === 0) {
    const hours = intervalSeconds / 3600;
    return hours === 1 ? "Every hour" : `Every ${hours} hours`;
  }
  if (intervalSeconds % 60 === 0) {
    const minutes = intervalSeconds / 60;
    return minutes === 1 ? "Every 1 min" : `Every ${minutes} min`;
  }
  return `Every ${intervalSeconds}s`;
}

function getInitialScheduleState(tx?: any | null) {
  if (tx?.cron_expression?.trim()) {
    return {
      mode: "cron" as const,
      schedule: tx.schedule || "Custom cron",
      customMinutes: "5",
      cronExpression: tx.cron_expression,
    };
  }

  const preset = schedulePresets.find((option) => option.label === tx?.schedule || option.seconds === tx?.interval_seconds);
  if (preset) {
    return {
      mode: "preset" as const,
      schedule: preset.label,
      customMinutes: String(Math.max(1, Math.round((preset.seconds || 300) / 60))),
      cronExpression: "",
    };
  }

  const intervalSeconds = tx?.interval_seconds || 300;
  return {
    mode: "custom" as const,
    schedule: formatScheduleLabel(tx?.schedule, intervalSeconds),
    customMinutes: String(Math.max(1, Math.round(intervalSeconds / 60))),
    cronExpression: "",
  };
}

function getSchedulePayload(
  scheduleMode: "preset" | "custom" | "cron",
  scheduleLabel: string,
  customMinutes: string,
  cronExpression: string,
) {
  if (scheduleMode === "cron") {
    const cron = cronExpression.trim();
    return {
      schedule: cron ? `Cron: ${cron}` : "Custom cron",
      cron_expression: cron,
      interval_seconds: 300,
    };
  }

  if (scheduleMode === "custom") {
    const minutes = Math.max(1, Number.parseInt(customMinutes, 10) || 5);
    const intervalSeconds = minutes * 60;
    return {
      schedule: minutes === 60 ? "Every hour" : `Every ${minutes} min`,
      cron_expression: null,
      interval_seconds: intervalSeconds,
    };
  }

  const preset = schedulePresets.find((option) => option.label === scheduleLabel) || schedulePresets[1];
  return {
    schedule: preset.label,
    cron_expression: null,
    interval_seconds: preset.seconds,
  };
}

function normalizeSteps(steps?: any[]): StepDraft[] {
  return (steps || []).map((step: any, index: number) => ({
    id: step.id,
    order: index + 1,
    type: step.type,
    label: step.label,
    config: step.config || {},
  }));
}

function blankConfigForType(type: string) {
  switch (type) {
    case "navigate":
      return { url: "", wait_until: "domcontentloaded" };
    case "input":
      return { selector: "", value: "" };
    case "click":
      return { selector: "" };
    case "assert":
      return { selector: "", text: "" };
    case "wait":
      return { selector: "", text: "", time_ms: 1000 };
    case "api":
      return { method: "GET", url: "", expected_status: 200, headers_json: "", body_json: "" };
    default:
      return {};
  }
}

function createBlankStep(type = "navigate", order = 1): StepDraft {
  return {
    order,
    type,
    label: "",
    config: blankConfigForType(type),
  };
}

function coerceStepConfig(step: StepDraft) {
  const config = { ...(step.config || {}) };
  if (step.type === "api") {
    let headers: Record<string, any> | undefined;
    let body: Record<string, any> | undefined;

    if (typeof config.headers_json === "string" && config.headers_json.trim()) {
      headers = JSON.parse(config.headers_json);
    }
    if (typeof config.body_json === "string" && config.body_json.trim()) {
      body = JSON.parse(config.body_json);
    }

    return {
      method: (config.method || "GET").toUpperCase(),
      url: config.url || "",
      expected_status: Number(config.expected_status || 200),
      ...(headers ? { headers } : {}),
      ...(body ? { body } : {}),
    };
  }

  if (step.type === "wait") {
    const result: Record<string, any> = {};
    if (config.selector) result.selector = config.selector;
    if (config.text) result.text = config.text;
    if (config.time_ms) result.time_ms = Number(config.time_ms);
    return result;
  }

  return Object.fromEntries(
    Object.entries(config).filter(([, value]) => value !== "" && value !== null && value !== undefined),
  );
}

function toEditableConfig(step: any) {
  const config = { ...(step.config || {}) };
  if (step.type === "api") {
    return {
      method: config.method || "GET",
      url: config.url || "",
      expected_status: config.expected_status || config.status || 200,
      headers_json: config.headers ? JSON.stringify(config.headers, null, 2) : "",
      body_json: config.body ? JSON.stringify(config.body, null, 2) : "",
    };
  }
  return config;
}

function describeStep(step: StepDraft) {
  return step.config?.url || step.config?.selector || step.config?.text || step.config?.value || step.type;
}

export default function TransactionsPage() {
  const [selectedTx, setSelectedTx] = useState<string | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderMode, setBuilderMode] = useState<"create" | "edit">("create");
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<any | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [newTxName, setNewTxName] = useState("");
  const [description, setDescription] = useState("");
  const [generatedSteps, setGeneratedSteps] = useState<StepDraft[]>([]);
  const [transactionEnabled, setTransactionEnabled] = useState(true);
  const [scheduleMode, setScheduleMode] = useState<"preset" | "custom" | "cron">("preset");
  const [newTxSchedule, setNewTxSchedule] = useState("Every 5 min");
  const [customIntervalMinutes, setCustomIntervalMinutes] = useState("5");
  const [cronExpression, setCronExpression] = useState("");
  const [transactionToDelete, setTransactionToDelete] = useState<any | null>(null);
  const queryClient = useQueryClient();

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions"],
    queryFn: api.listTransactions,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!selectedTx && transactions.length > 0) {
      setSelectedTx(transactions[0].id);
      return;
    }
    if (selectedTx && !transactions.some((tx: any) => tx.id === selectedTx)) {
      setSelectedTx(transactions[0]?.id ?? null);
    }
  }, [transactions, selectedTx]);

  const selectedTransaction = transactions.find((t: any) => t.id === selectedTx);

  const { data: runs = [] } = useQuery({
    queryKey: ["transaction-runs", selectedTx],
    queryFn: () => api.listTransactionRuns(selectedTx!, 100),
    enabled: !!selectedTx,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!selectedRun) return;
    const freshRun = runs.find((run: any) => run.id === selectedRun.id);
    if (freshRun) setSelectedRun(freshRun);
  }, [runs, selectedRun]);

  const latestRun = runs[0];
  const runCounts = useMemo(
    () => ({
      total: runs.length,
      success: runs.filter((r: any) => r.status === "success").length,
      failed: runs.filter((r: any) => r.status === "failed").length,
      running: runs.filter((r: any) => r.status === "running").length,
    }),
    [runs],
  );

  const resetBuilder = () => {
    setBuilderMode("create");
    setEditingTxId(null);
    setShowBuilder(false);
    setAiPrompt("");
    setNewTxName("");
    setDescription("");
    setGeneratedSteps([]);
    setTransactionEnabled(true);
    setScheduleMode("preset");
    setNewTxSchedule("Every 5 min");
    setCustomIntervalMinutes("5");
    setCronExpression("");
  };

  const openCreateBuilder = () => {
    resetBuilder();
    setShowBuilder(true);
  };

  const openEditBuilder = (tx: any) => {
    const initialSchedule = getInitialScheduleState(tx);
    setBuilderMode("edit");
    setEditingTxId(tx.id);
    setShowBuilder(true);
    setAiPrompt("");
    setNewTxName(tx.name || "");
    setDescription(tx.description || "");
    setGeneratedSteps(
      normalizeSteps((tx.steps || []).map((step: any) => ({ ...step, config: toEditableConfig(step) }))),
    );
    setTransactionEnabled(tx.enabled ?? true);
    setScheduleMode(initialSchedule.mode);
    setNewTxSchedule(initialSchedule.schedule);
    setCustomIntervalMinutes(initialSchedule.customMinutes);
    setCronExpression(initialSchedule.cronExpression);
  };

  const runMutation = useMutation({
    mutationFn: (id: string) => api.runTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transaction-runs", selectedTx] });
      toast.success("Transaction queued");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to run transaction"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteTransaction(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transaction-runs", id] });
      if (selectedTx === id) {
        setSelectedTx(null);
        setSelectedRun(null);
      }
      toast.success("Transaction deleted");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to delete transaction"),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createTransaction(data),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setSelectedTx(created.id);
      resetBuilder();
      toast.success(`Created ${created.name}`);
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create transaction"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateTransaction(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transaction-runs", updated.id] });
      setSelectedTx(updated.id);
      resetBuilder();
      toast.success(`Updated ${updated.name}`);
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update transaction"),
  });

  const generateMutation = useMutation({
    mutationFn: (prompt: string) => api.aiGenerateTransaction(prompt),
    onSuccess: (data) => {
      setGeneratedSteps(
        normalizeSteps(
          (data.steps || []).map((step: any) => ({
            ...step,
            config: toEditableConfig(step),
          })),
        ),
      );
      if (data.name && !newTxName) setNewTxName(data.name);
      toast.success("Generated transaction steps");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to generate transaction"),
  });

  const handleAiGenerate = () => {
    if (!aiPrompt.trim()) return;
    if (!showBuilder) openCreateBuilder();
    generateMutation.mutate(aiPrompt);
  };

  const updateStep = (index: number, patch: Partial<StepDraft>) => {
    setGeneratedSteps((steps) =>
      steps.map((step, stepIndex) => (stepIndex === index ? { ...step, ...patch } : step)),
    );
  };

  const updateStepConfig = (index: number, key: string, value: any) => {
    setGeneratedSteps((steps) =>
      steps.map((step, stepIndex) =>
        stepIndex === index ? { ...step, config: { ...(step.config || {}), [key]: value } } : step,
      ),
    );
  };

  const changeStepType = (index: number, type: string) => {
    setGeneratedSteps((steps) =>
      steps.map((step, stepIndex) => {
        if (stepIndex !== index) return step;
        return {
          ...step,
          type,
          label: step.label || stepTypeOptions.find((option) => option.value === type)?.label || "",
          config: blankConfigForType(type),
        };
      }),
    );
  };

  const addManualStep = () => {
    setGeneratedSteps((steps) => [...steps, createBlankStep("navigate", steps.length + 1)]);
  };

  const removeStep = (index: number) => {
    setGeneratedSteps((steps) =>
      steps
        .filter((_, stepIndex) => stepIndex !== index)
        .map((step, stepIndex) => ({ ...step, order: stepIndex + 1 })),
    );
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    setGeneratedSteps((steps) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= steps.length) return steps;
      const next = [...steps];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next.map((step, stepIndex) => ({ ...step, order: stepIndex + 1 }));
    });
  };

  const handleSave = () => {
    if (!newTxName.trim()) {
      toast.error("Transaction name is required");
      return;
    }
    if (!generatedSteps.length) {
      toast.error("Add or generate at least one step");
      return;
    }
    if (scheduleMode === "cron" && !cronExpression.trim()) {
      toast.error("Cron expression is required");
      return;
    }

    let stepsPayload;
    try {
      stepsPayload = generatedSteps.map((step, index) => ({
        order: index + 1,
        type: step.type,
        label:
          step.label.trim() ||
          `${stepTypeOptions.find((option) => option.value === step.type)?.label || step.type} ${index + 1}`,
        config: coerceStepConfig(step),
      }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid step configuration");
      return;
    }

    const schedulePayload = getSchedulePayload(
      scheduleMode,
      newTxSchedule,
      customIntervalMinutes,
      cronExpression,
    );

    const payload = {
      name: newTxName.trim(),
      description: description.trim() || null,
      schedule: schedulePayload.schedule,
      cron_expression: schedulePayload.cron_expression,
      interval_seconds: schedulePayload.interval_seconds,
      enabled: transactionEnabled,
      steps: stepsPayload,
    };

    if (builderMode === "edit" && editingTxId) {
      updateMutation.mutate({ id: editingTxId, data: payload });
      return;
    }

    createMutation.mutate(payload);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <motion.div className="space-y-5 p-3 pb-6 sm:space-y-6 sm:p-6" variants={container} initial="hidden" animate="show">
        <motion.div variants={item}>
          <PageHeader title="Transaction Monitoring" description="Monitor real user workflows end-to-end">
            <Button onClick={openCreateBuilder} className="h-11 w-full gap-2 sm:h-10 sm:w-auto">
              <Plus className="h-4 w-4" />
              New Transaction
            </Button>
          </PageHeader>
        </motion.div>

        <motion.div variants={item}>
          <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
            <Bot className="h-5 w-5 shrink-0 text-primary" />
            <Input
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAiGenerate()}
              placeholder="Describe a transaction to monitor... e.g. 'Monitor login and verify account balance'"
              className="border-none bg-transparent shadow-none focus-visible:ring-0"
            />
            <Button onClick={handleAiGenerate} disabled={generateMutation.isPending} className="h-11 w-full gap-2 sm:h-10 sm:w-auto">
              {generateMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              Generate
            </Button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5 lg:gap-6">
          <motion.div variants={item} className="lg:col-span-3">
            <div className="rounded-lg border border-border bg-card">
              <div className="border-b border-border px-4 py-3 sm:px-5">
                <h2 className="text-sm font-medium">Active Monitors</h2>
              </div>
              <div className="divide-y divide-border">
                {transactions.map((tx: any) => (
                  <div
                    key={tx.id}
                    onClick={() => {
                      setSelectedTx(tx.id === selectedTx ? null : tx.id);
                      setSelectedRun(null);
                    }}
                    className={`cursor-pointer flex flex-col gap-3 px-4 py-4 transition-colors sm:flex-row sm:items-center sm:gap-4 sm:px-5 ${
                      selectedTx === tx.id ? "bg-surface-hover" : "hover:bg-surface-hover"
                    }`}
                  >
                    <Zap className={`h-4 w-4 shrink-0 ${tx.status === "healthy" ? "text-success" : tx.status === "warning" ? "text-warning" : "text-critical"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{tx.name}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{tx.steps?.length || 0} steps</span>
                        <span>•</span>
                        <span>{formatScheduleLabel(tx.schedule, tx.interval_seconds, tx.cron_expression)}</span>
                      </div>
                    </div>
                    <div className="grid w-full grid-cols-3 gap-3 text-left sm:flex sm:w-auto sm:flex-nowrap sm:items-center sm:gap-4 sm:text-right">
                      <div>
                        <p className={`font-mono text-sm ${tx.success_rate >= 99 ? "text-success" : tx.success_rate >= 97 ? "text-warning" : "text-critical"}`}>
                          {tx.success_rate}%
                        </p>
                        <p className="text-xs text-muted-foreground">success</p>
                      </div>
                      <div>
                        <p className="font-mono text-sm">{tx.avg_duration_ms ? `${(tx.avg_duration_ms / 1000).toFixed(1)}s` : "N/A"}</p>
                        <p className="text-xs text-muted-foreground">avg</p>
                      </div>
                      <div className="flex items-center justify-start sm:justify-end">
                        <StatusBadge variant={!tx.enabled ? "warning" : tx.status}>{!tx.enabled ? "paused" : tx.status}</StatusBadge>
                      </div>
                    </div>
                  </div>
                ))}
                {!transactions.length && (
                  <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No transactions yet. Create one to start monitoring workflows.
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          <motion.div variants={item} className="space-y-4 lg:col-span-2">
            <div className="rounded-lg border border-border bg-card">
              <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <h2 className="min-w-0 text-sm font-medium">{selectedTransaction ? selectedTransaction.name : "Transaction Steps"}</h2>
                {selectedTransaction && (
                  <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:items-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => runMutation.mutate(selectedTransaction.id)}
                      disabled={runMutation.isPending}
                      className="h-10 gap-1 text-primary sm:h-9"
                    >
                      {runMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />} Run
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEditBuilder(selectedTransaction)} className="h-10 gap-1 sm:h-9">
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTransactionToDelete(selectedTransaction)}
                      disabled={deleteMutation.isPending}
                      className="h-10 gap-1 hover:text-destructive sm:h-9"
                    >
                      {deleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Delete
                    </Button>
                  </div>
                )}
              </div>
              <div className="p-4">
                {selectedTransaction?.steps?.length ? (
                  <div className="space-y-0">
                    {selectedTransaction.steps.map((step: any, i: number) => {
                      const Icon = stepIcons[step.type] || Code;
                      const latestStep = latestRun?.step_results?.find((r: any) => r.order === step.order);
                      const latestOk = latestStep ? latestStep.status === "success" : false;
                      return (
                        <div key={step.id || `${step.order}-${step.label}`} className="relative">
                          {i < selectedTransaction.steps.length - 1 && <div className="absolute left-[15px] top-[32px] h-[calc(100%-8px)] w-px bg-border" />}
                          <div className="flex items-start gap-3 py-2">
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${latestStep ? (latestOk ? "bg-success/10 text-success" : "bg-critical/10 text-critical") : "bg-surface text-muted-foreground"}`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1 pt-0.5">
                              <p className="text-sm font-medium">{step.label}</p>
                              <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                                {step.config?.url || step.config?.selector || step.config?.text || step.config?.value || step.type}
                              </p>
                              {latestStep?.error_message && (
                                <p className="mt-1 line-clamp-2 text-xs text-critical">{latestStep.error_message}</p>
                              )}
                            </div>
                            {latestStep ? latestOk ? <CheckCircle className="mt-1 h-4 w-4 shrink-0 text-success" /> : <XCircle className="mt-1 h-4 w-4 shrink-0 text-critical" /> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Zap className="mb-3 h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">Select a transaction to view steps</p>
                  </div>
                )}
              </div>
            </div>

            {selectedTransaction && latestRun && (
              <div className="rounded-lg border border-border bg-card">
                <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <h2 className="text-sm font-medium">Latest replay</h2>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <StatusBadge variant={latestRun.status === "success" ? "healthy" : latestRun.status === "failed" ? "critical" : "warning"}>{latestRun.status}</StatusBadge>
                    <span>{formatDuration(latestRun.duration_ms)}</span>
                  </div>
                </div>
                <div className="space-y-3 p-4">
                  {latestRun.replay_url ? (
                    <video key={latestRun.replay_url} src={latestRun.replay_url} controls playsInline preload="metadata" className="max-h-[260px] w-full rounded-lg border border-border bg-black" />
                  ) : (
                    <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">No replay yet for this run.</div>
                  )}
                  {latestRun.ai_summary && <div className="whitespace-pre-wrap rounded-lg bg-surface px-3 py-3 text-sm text-foreground">{latestRun.ai_summary}</div>}
                </div>
              </div>
            )}

            {selectedTransaction && (
              <div className="rounded-lg border border-border bg-card">
                <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div>
                    <h2 className="text-sm font-medium">Run history</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">Full historical list with run details.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{runCounts.total} total</span>
                    <span>•</span>
                    <span>{runCounts.success} ok</span>
                    <span>•</span>
                    <span>{runCounts.failed} failed</span>
                    {runCounts.running > 0 && (
                      <>
                        <span>•</span>
                        <span>{runCounts.running} running</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="max-h-[520px] space-y-3 overflow-auto p-4">
                  {runs.length ? (
                    runs.map((run: any) => {
                      const failedStep = run.step_results?.find((s: any) => s.status === "failed");
                      const successfulSteps = run.step_results?.filter((s: any) => s.status === "success").length || 0;
                      const totalSteps = run.step_results?.length || selectedTransaction.steps?.length || 0;
                      return (
                        <button
                          key={run.id}
                          type="button"
                          onClick={() => setSelectedRun(run)}
                          className={`w-full rounded-lg border p-3 text-left transition-colors active:scale-[0.99] ${selectedRun?.id === run.id ? "border-primary bg-primary/5" : "border-border bg-surface hover:bg-surface-hover"}`}
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 text-sm font-medium">
                                <History className="h-4 w-4 text-muted-foreground" />
                                <span className="truncate">{formatDateTime(run.started_at)}</span>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span>{formatDuration(run.duration_ms)}</span>
                                <span>•</span>
                                <span>{successfulSteps}/{totalSteps} steps passed</span>
                                {run.replay_url && (
                                  <>
                                    <span>•</span>
                                    <span>replay</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <StatusBadge variant={run.status === "success" ? "healthy" : run.status === "failed" ? "critical" : "warning"}>{run.status}</StatusBadge>
                          </div>
                          {run.error_message && <div className="mt-3 whitespace-pre-wrap text-sm text-critical">{run.error_message}</div>}
                          {!run.error_message && failedStep?.error_message && <div className="mt-3 whitespace-pre-wrap text-sm text-critical">{failedStep.error_message}</div>}
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">No runs yet.</div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </div>

        <AlertDialog open={!!transactionToDelete} onOpenChange={(open) => !open && setTransactionToDelete(null)}>
          <AlertDialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete transaction</AlertDialogTitle>
              <AlertDialogDescription>
                {transactionToDelete ? `Delete transaction "${transactionToDelete.name}"? This cannot be undone.` : "This cannot be undone."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (transactionToDelete) {
                    deleteMutation.mutate(transactionToDelete.id);
                    setTransactionToDelete(null);
                  }
                }}
              >
                {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AnimatePresence>
          {showBuilder && (
            <>
              <motion.div
                className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={resetBuilder}
              />
              <motion.div
                className="fixed inset-y-0 right-0 z-50 w-full max-w-3xl border-l border-border bg-card shadow-2xl"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
              >
                <div className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4 sm:items-center sm:px-6">
                    <div>
                      <h2 className="text-lg font-semibold">{builderMode === "edit" ? "Edit Transaction" : "Transaction Builder"}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {builderMode === "edit" ? "Update schedule, enabled state, and steps." : "Create a monitor for a real user workflow."}
                      </p>
                    </div>
                    <Button variant="ghost" onClick={resetBuilder}>Close</Button>
                  </div>

                  <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2 sm:col-span-2">
                        <label className="text-sm font-medium">Transaction Name</label>
                        <Input value={newTxName} onChange={(e) => setNewTxName(e.target.value)} placeholder="e.g. User Login Flow" />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <label className="text-sm font-medium">Description</label>
                        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" className="min-h-[80px]" />
                      </div>
                    </div>

                    <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 sm:items-center">
                      <div>
                        <div className="text-sm font-medium">Enabled</div>
                        <div className="mt-1 text-xs text-muted-foreground">Pause scheduling without deleting the transaction.</div>
                      </div>
                      <Switch checked={transactionEnabled} onCheckedChange={setTransactionEnabled} />
                    </div>

                    <div className="space-y-3 rounded-xl border border-border p-4">
                      <div>
                        <div className="text-sm font-medium">Run schedule</div>
                        <div className="mt-1 text-xs text-muted-foreground">Use a preset interval, custom minutes, or a real cron expression.</div>
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {(["preset", "custom", "cron"] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setScheduleMode(mode)}
                            className={`rounded-lg border px-3 py-2 text-sm capitalize transition-colors ${scheduleMode === mode ? "border-primary bg-primary/5 text-primary" : "border-border bg-surface text-foreground hover:bg-surface-hover"}`}
                          >
                            {mode === "preset" ? "Preset interval" : mode === "custom" ? "Custom minutes" : "Cron schedule"}
                          </button>
                        ))}
                      </div>

                      {scheduleMode === "preset" && (
                        <Select value={newTxSchedule} onValueChange={setNewTxSchedule}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select interval" />
                          </SelectTrigger>
                          <SelectContent>
                            {schedulePresets.map((preset) => (
                              <SelectItem key={preset.label} value={preset.label}>{preset.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {scheduleMode === "custom" && (
                        <div className="space-y-2">
                          <Input type="number" min="1" step="1" value={customIntervalMinutes} onChange={(e) => setCustomIntervalMinutes(e.target.value)} />
                          <p className="text-xs text-muted-foreground">Runs every {Math.max(1, Number.parseInt(customIntervalMinutes, 10) || 5)} minute(s).</p>
                        </div>
                      )}

                      {scheduleMode === "cron" && (
                        <div className="space-y-2">
                          <Input value={cronExpression} onChange={(e) => setCronExpression(e.target.value)} placeholder="*/5 * * * *" />
                          <p className="text-xs text-muted-foreground">Standard 5-part cron expression in UTC. Example: <span className="font-mono">*/5 * * * *</span></p>
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Bot className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium text-primary">AI Generate Steps</span>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && generateMutation.mutate(aiPrompt)} placeholder={builderMode === "edit" ? "Describe replacement steps or refinements..." : "Describe the workflow..."} />
                        <Button onClick={() => generateMutation.mutate(aiPrompt)} disabled={generateMutation.isPending || !aiPrompt.trim()} className="h-11 gap-2 sm:h-10">
                          {generateMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                          Generate
                        </Button>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">Generating again replaces the current editable step list.</p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-sm font-medium">Steps ({generatedSteps.length})</h3>
                          <p className="text-xs text-muted-foreground">Manual editing is enabled. Add, remove, and reorder steps here.</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={addManualStep} className="h-11 gap-2 sm:h-9">
                          <Plus className="h-4 w-4" /> Add step
                        </Button>
                      </div>

                      {generatedSteps.length ? (
                        generatedSteps.map((step, index) => {
                          const Icon = stepIcons[step.type] || Code;
                          return (
                            <div key={step.id || index} className="space-y-4 rounded-xl border border-border bg-surface p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-3">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground">
                                    <Icon className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium">Step {index + 1}</div>
                                    <div className="truncate text-xs text-muted-foreground">{describeStep(step)}</div>
                                  </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
                                  <Button variant="outline" size="icon" onClick={() => moveStep(index, -1)} disabled={index === 0} className="h-11 w-full sm:h-10 sm:w-10"><ChevronUp className="h-4 w-4" /></Button>
                                  <Button variant="outline" size="icon" onClick={() => moveStep(index, 1)} disabled={index === generatedSteps.length - 1} className="h-11 w-full sm:h-10 sm:w-10"><ChevronDown className="h-4 w-4" /></Button>
                                  <Button variant="outline" size="icon" onClick={() => removeStep(index)} className="h-11 w-full sm:h-10 sm:w-10"><Trash2 className="h-4 w-4" /></Button>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="space-y-2">
                                  <label className="text-xs font-medium text-muted-foreground">Type</label>
                                  <Select value={step.type} onValueChange={(value) => changeStepType(index, value)}>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {stepTypeOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <label className="text-xs font-medium text-muted-foreground">Label</label>
                                  <Input value={step.label} onChange={(e) => updateStep(index, { label: e.target.value })} placeholder="Describe this step" />
                                </div>
                              </div>

                              {step.type === "navigate" && (
                                <div className="space-y-2">
                                  <label className="text-xs font-medium text-muted-foreground">URL</label>
                                  <Input value={step.config?.url || ""} onChange={(e) => updateStepConfig(index, "url", e.target.value)} placeholder="https://example.com/login" />
                                </div>
                              )}

                              {step.type === "input" && (
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground">Selector</label>
                                    <Input value={step.config?.selector || ""} onChange={(e) => updateStepConfig(index, "selector", e.target.value)} placeholder="#email" />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground">Value</label>
                                    <Input value={step.config?.value || ""} onChange={(e) => updateStepConfig(index, "value", e.target.value)} placeholder="user@example.com" />
                                  </div>
                                </div>
                              )}

                              {step.type === "click" && (
                                <div className="space-y-2">
                                  <label className="text-xs font-medium text-muted-foreground">Selector</label>
                                  <Input value={step.config?.selector || ""} onChange={(e) => updateStepConfig(index, "selector", e.target.value)} placeholder="button[type=submit]" />
                                </div>
                              )}

                              {step.type === "assert" && (
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground">Selector (optional)</label>
                                    <Input value={step.config?.selector || ""} onChange={(e) => updateStepConfig(index, "selector", e.target.value)} placeholder="#balance" />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground">Expected text</label>
                                    <Input value={step.config?.text || ""} onChange={(e) => updateStepConfig(index, "text", e.target.value)} placeholder="£123.45" />
                                  </div>
                                </div>
                              )}

                              {step.type === "wait" && (
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                  <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground">Selector</label>
                                    <Input value={step.config?.selector || ""} onChange={(e) => updateStepConfig(index, "selector", e.target.value)} placeholder=".loaded" />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground">Text</label>
                                    <Input value={step.config?.text || ""} onChange={(e) => updateStepConfig(index, "text", e.target.value)} placeholder="Welcome back" />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground">Fallback wait (ms)</label>
                                    <Input type="number" value={step.config?.time_ms || ""} onChange={(e) => updateStepConfig(index, "time_ms", e.target.value)} placeholder="1000" />
                                  </div>
                                </div>
                              )}

                              {step.type === "api" && (
                                <div className="grid grid-cols-1 gap-3">
                                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    <div className="space-y-2">
                                      <label className="text-xs font-medium text-muted-foreground">Method</label>
                                      <Input value={step.config?.method || "GET"} onChange={(e) => updateStepConfig(index, "method", e.target.value.toUpperCase())} placeholder="GET" />
                                    </div>
                                    <div className="space-y-2 sm:col-span-2">
                                      <label className="text-xs font-medium text-muted-foreground">URL</label>
                                      <Input value={step.config?.url || ""} onChange={(e) => updateStepConfig(index, "url", e.target.value)} placeholder="https://api.example.com/health" />
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    <div className="space-y-2">
                                      <label className="text-xs font-medium text-muted-foreground">Expected status</label>
                                      <Input type="number" value={step.config?.expected_status || 200} onChange={(e) => updateStepConfig(index, "expected_status", e.target.value)} />
                                    </div>
                                    <div className="space-y-2 sm:col-span-2">
                                      <label className="text-xs font-medium text-muted-foreground">Headers JSON</label>
                                      <Textarea value={step.config?.headers_json || ""} onChange={(e) => updateStepConfig(index, "headers_json", e.target.value)} placeholder='{"Authorization":"Bearer ..."}' className="min-h-[90px] font-mono text-xs" />
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground">Body JSON</label>
                                    <Textarea value={step.config?.body_json || ""} onChange={(e) => updateStepConfig(index, "body_json", e.target.value)} placeholder='{"ping":true}' className="min-h-[100px] font-mono text-xs" />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">No steps yet. Generate them with AI or add one manually.</div>
                      )}
                    </div>
                  </div>

                  <div className="sticky bottom-0 z-10 flex flex-col-reverse gap-3 border-t border-border bg-card/95 px-4 py-4 backdrop-blur sm:flex-row sm:justify-end sm:px-6" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
                    <Button variant="outline" onClick={resetBuilder} className="h-11 w-full sm:h-10 sm:w-auto">Cancel</Button>
                    <Button onClick={handleSave} disabled={!newTxName.trim() || isSaving} className="h-11 w-full gap-2 sm:h-10 sm:w-auto">
                      {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                      {builderMode === "edit" ? "Save Changes" : "Create Monitor"}
                    </Button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </motion.div>

      <Sheet open={!!selectedRun} onOpenChange={(open) => !open && setSelectedRun(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto border-l border-border bg-card p-0 sm:max-w-3xl">
          {selectedRun && (
            <div className="flex h-full flex-col">
              <div className="border-b border-border px-4 py-4 sm:px-6 sm:py-5">
                <SheetHeader className="pr-10">
                  <SheetTitle className="flex items-center gap-3">
                    <span>Run details</span>
                    <StatusBadge variant={selectedRun.status === "success" ? "healthy" : selectedRun.status === "failed" ? "critical" : "warning"}>{selectedRun.status}</StatusBadge>
                  </SheetTitle>
                  <SheetDescription>
                    {selectedTransaction?.name || "Transaction"} • started {formatDateTime(selectedRun.started_at)}
                  </SheetDescription>
                </SheetHeader>
              </div>

              <div className="flex-1 space-y-5 px-4 py-4 sm:space-y-6 sm:px-6 sm:py-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-border bg-surface p-4">
                    <div className="text-xs text-muted-foreground">Started</div>
                    <div className="mt-1 text-sm font-medium">{formatDateTime(selectedRun.started_at)}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-surface p-4">
                    <div className="text-xs text-muted-foreground">Completed</div>
                    <div className="mt-1 text-sm font-medium">{formatDateTime(selectedRun.completed_at)}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-surface p-4">
                    <div className="text-xs text-muted-foreground">Duration</div>
                    <div className="mt-1 text-sm font-medium">{formatDuration(selectedRun.duration_ms)}</div>
                  </div>
                </div>

                {selectedRun.error_message && (
                  <div className="rounded-lg border border-critical/30 bg-critical/5 p-4">
                    <div className="text-sm font-medium text-critical">Run error</div>
                    <div className="mt-2 whitespace-pre-wrap text-sm text-critical">{selectedRun.error_message}</div>
                  </div>
                )}

                {selectedRun.replay_url && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium">Replay</h3>
                    <video src={selectedRun.replay_url} controls playsInline preload="metadata" className="max-h-[320px] w-full rounded-lg border border-border bg-black" />
                  </div>
                )}

                {selectedRun.ai_summary && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium">AI summary</h3>
                    <div className="whitespace-pre-wrap rounded-lg border border-border bg-surface p-4 text-sm text-foreground">{selectedRun.ai_summary}</div>
                  </div>
                )}

                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Step results</h3>
                  <div className="space-y-3">
                    {(selectedRun.step_results || []).map((step: any) => {
                      const Icon = stepIcons[step.type] || Code;
                      const variantClass =
                        step.status === "success"
                          ? "border-success/30 bg-success/5"
                          : step.status === "failed"
                            ? "border-critical/30 bg-critical/5"
                            : "border-border bg-surface";

                      return (
                        <div key={step.id} className={`rounded-lg border p-4 ${variantClass}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground">
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-medium">{step.order}. {step.label}</div>
                                <div className="mt-1 text-xs text-muted-foreground">{step.type} • {formatDuration(step.duration_ms)}</div>
                              </div>
                            </div>
                            <StatusBadge variant={step.status === "success" ? "healthy" : step.status === "failed" ? "critical" : "warning"}>{step.status}</StatusBadge>
                          </div>

                          {step.detail && <div className="mt-3 whitespace-pre-wrap text-sm text-foreground">{step.detail}</div>}
                          {step.error_message && <div className="mt-3 whitespace-pre-wrap text-sm text-critical">{step.error_message}</div>}
                          {step.reply && <div className="mt-3 whitespace-pre-wrap rounded-md bg-background px-3 py-2 text-sm text-foreground">{step.reply}</div>}
                          {step.screenshot_url && <img src={step.screenshot_url} alt={`Screenshot for ${step.label}`} className="mt-3 w-full rounded-lg border border-border" />}
                        </div>
                      );
                    })}
                    {!selectedRun.step_results?.length && (
                      <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">No step results captured for this run.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
