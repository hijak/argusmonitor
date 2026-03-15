import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, Zap, Play, Clock, CheckCircle, XCircle, Globe, MousePointer, Type, Eye, Code, Bot, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const stepIcons: Record<string, typeof Globe> = {
  navigate: Globe,
  input: Type,
  click: MousePointer,
  assert: Eye,
  api: Code,
  wait: Clock,
};

const container = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const item = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.15 } } };

export default function TransactionsPage() {
  const [selectedTx, setSelectedTx] = useState<string | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [newTxName, setNewTxName] = useState("");
  const [newTxSchedule, setNewTxSchedule] = useState("Every 5 min");
  const [generatedSteps, setGeneratedSteps] = useState<any[]>([]);
  const queryClient = useQueryClient();

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions"],
    queryFn: api.listTransactions,
    refetchInterval: 30000,
  });

  const selectedTransaction = transactions.find((t: any) => t.id === selectedTx);

  const runMutation = useMutation({
    mutationFn: (id: string) => api.runTransaction(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["transactions"] }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createTransaction(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setShowBuilder(false);
      setNewTxName("");
      setGeneratedSteps([]);
    },
  });

  const generateMutation = useMutation({
    mutationFn: (prompt: string) => api.aiGenerateTransaction(prompt),
    onSuccess: (data) => {
      setGeneratedSteps(data.steps || []);
      if (data.name && !newTxName) setNewTxName(data.name);
    },
  });

  const handleAiGenerate = () => {
    if (!aiPrompt.trim()) return;
    generateMutation.mutate(aiPrompt);
    if (!showBuilder) {
      setShowBuilder(true);
      setNewTxName("");
    }
  };

  const handleCreate = () => {
    const intervalMap: Record<string, number> = {
      "Every 1 min": 60, "Every 5 min": 300, "Every 15 min": 900, "Every 30 min": 1800, "Every hour": 3600,
    };
    createMutation.mutate({
      name: newTxName,
      schedule: newTxSchedule,
      interval_seconds: intervalMap[newTxSchedule] || 300,
      steps: generatedSteps.map((s: any, i: number) => ({
        order: s.order || i + 1,
        type: s.type,
        label: s.label,
        config: s.config || {},
      })),
    });
  };

  return (
    <motion.div className="p-6 space-y-6" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}>
        <PageHeader title="Transaction Monitoring" description="Monitor real user workflows end-to-end">
          <button
            onClick={() => { setShowBuilder(true); setGeneratedSteps([]); setNewTxName(""); }}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New Transaction
          </button>
        </PageHeader>
      </motion.div>

      <motion.div variants={item}>
        <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4">
          <Bot className="h-5 w-5 text-primary" />
          <input
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAiGenerate()}
            placeholder="Describe a transaction to monitor... e.g. 'Monitor logging into our web app and checking account balance'"
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={handleAiGenerate}
            disabled={generateMutation.isPending}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {generateMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
            Generate
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <motion.div variants={item} className="lg:col-span-3">
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-5 py-3">
              <h2 className="text-sm font-medium">Active Monitors</h2>
            </div>
            <div className="divide-y divide-border">
              {transactions.map((tx: any) => (
                <div
                  key={tx.id}
                  onClick={() => setSelectedTx(tx.id === selectedTx ? null : tx.id)}
                  className={`flex items-center gap-4 px-5 py-4 transition-colors cursor-pointer ${
                    selectedTx === tx.id ? "bg-surface-hover" : "hover:bg-surface-hover"
                  }`}
                >
                  <Zap className={`h-4 w-4 shrink-0 ${tx.status === "healthy" ? "text-success" : tx.status === "warning" ? "text-warning" : "text-critical"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{tx.name}</p>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{tx.steps?.length || 0} steps</span>
                      <span>•</span>
                      <span>{tx.schedule}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right">
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
                    <StatusBadge variant={tx.status}>{tx.status}</StatusBadge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div variants={item} className="lg:col-span-2">
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="text-sm font-medium">
                {selectedTransaction ? selectedTransaction.name : "Transaction Steps"}
              </h2>
              {selectedTransaction && (
                <button
                  onClick={() => runMutation.mutate(selectedTransaction.id)}
                  disabled={runMutation.isPending}
                  className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
                >
                  {runMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />} Run Now
                </button>
              )}
            </div>
            <div className="p-4">
              {selectedTransaction?.steps?.length ? (
                <div className="space-y-0">
                  {selectedTransaction.steps.map((step: any, i: number) => {
                    const Icon = stepIcons[step.type] || Code;
                    return (
                      <div key={step.id} className="relative">
                        {i < selectedTransaction.steps.length - 1 && (
                          <div className="absolute left-[15px] top-[32px] h-[calc(100%-8px)] w-px bg-border" />
                        )}
                        <div className="flex items-start gap-3 py-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <p className="text-sm font-medium">{step.label}</p>
                            <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                              {step.config?.url || step.config?.selector || step.config?.value || step.type}
                            </p>
                          </div>
                          <CheckCircle className="mt-1 h-4 w-4 shrink-0 text-success" />
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
        </motion.div>
      </div>

      <AnimatePresence>
        {showBuilder && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBuilder(false)}
            />
            <motion.div
              className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl border-l border-border bg-card shadow-2xl"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
            >
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-border px-6 py-4">
                  <h2 className="text-lg font-semibold">Transaction Builder</h2>
                  <button onClick={() => setShowBuilder(false)} className="text-muted-foreground hover:text-foreground">x</button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Transaction Name</label>
                    <input
                      value={newTxName}
                      onChange={e => setNewTxName(e.target.value)}
                      placeholder="e.g. User Login Flow"
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50"
                    />
                  </div>

                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Bot className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-primary">AI Generate Steps</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={aiPrompt}
                        onChange={e => setAiPrompt(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && generateMutation.mutate(aiPrompt)}
                        placeholder="Describe the workflow..."
                        className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                      />
                      <button
                        onClick={() => generateMutation.mutate(aiPrompt)}
                        disabled={generateMutation.isPending}
                        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                      >
                        {generateMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                        Generate
                      </button>
                    </div>
                  </div>

                  {generatedSteps.length > 0 && (
                    <div>
                      <h3 className="mb-3 text-sm font-medium">Generated Steps ({generatedSteps.length})</h3>
                      <div className="space-y-2">
                        {generatedSteps.map((step: any, i: number) => {
                          const Icon = stepIcons[step.type] || Code;
                          return (
                            <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <span className="flex-1">{step.label}</span>
                              <span className="text-xs text-muted-foreground">{step.type}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Run Schedule</label>
                    <select
                      value={newTxSchedule}
                      onChange={e => setNewTxSchedule(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none"
                    >
                      <option>Every 1 min</option>
                      <option>Every 5 min</option>
                      <option>Every 15 min</option>
                      <option>Every 30 min</option>
                      <option>Every hour</option>
                    </select>
                  </div>
                </div>
                <div className="border-t border-border px-6 py-4 flex gap-3 justify-end">
                  <button onClick={() => setShowBuilder(false)} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-surface-hover">Cancel</button>
                  <button
                    onClick={handleCreate}
                    disabled={!newTxName || createMutation.isPending}
                    className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {createMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                    Create Monitor
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
