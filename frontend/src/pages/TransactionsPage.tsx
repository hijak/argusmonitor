import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, Zap, Play, Clock, CheckCircle, XCircle, Globe, MousePointer, Type, Eye, Code, ArrowRight, Bot } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Transaction {
  id: string;
  name: string;
  status: "healthy" | "warning" | "critical";
  successRate: number;
  avgDuration: string;
  lastRun: string;
  steps: number;
  schedule: string;
}

const transactions: Transaction[] = [
  { id: "1", name: "User Login Flow", status: "healthy", successRate: 99.2, avgDuration: "1.2s", lastRun: "2 min ago", steps: 5, schedule: "Every 5 min" },
  { id: "2", name: "Checkout Process", status: "warning", successRate: 97.8, avgDuration: "3.4s", lastRun: "5 min ago", steps: 8, schedule: "Every 5 min" },
  { id: "3", name: "API Authentication", status: "healthy", successRate: 99.9, avgDuration: "0.3s", lastRun: "1 min ago", steps: 3, schedule: "Every 1 min" },
  { id: "4", name: "Report Export", status: "critical", successRate: 94.1, avgDuration: "8.2s", lastRun: "10 min ago", steps: 6, schedule: "Every 15 min" },
  { id: "5", name: "User Registration", status: "healthy", successRate: 99.5, avgDuration: "2.1s", lastRun: "3 min ago", steps: 7, schedule: "Every 10 min" },
  { id: "6", name: "Password Reset", status: "healthy", successRate: 99.8, avgDuration: "1.8s", lastRun: "8 min ago", steps: 4, schedule: "Every 30 min" },
];

const sampleSteps = [
  { id: 1, type: "navigate", label: "Navigate to URL", detail: "https://app.example.com/login", duration: "0.4s", status: "success" },
  { id: 2, type: "input", label: "Enter Email", detail: "input#email → test@example.com", duration: "0.1s", status: "success" },
  { id: 3, type: "input", label: "Enter Password", detail: "input#password → ••••••••", duration: "0.1s", status: "success" },
  { id: 4, type: "click", label: "Click Login Button", detail: "button.login-btn", duration: "0.2s", status: "success" },
  { id: 5, type: "assert", label: "Verify Dashboard Loaded", detail: "Assert text: 'Welcome back'", duration: "0.4s", status: "success" },
];

const stepIcons: Record<string, typeof Globe> = {
  navigate: Globe,
  input: Type,
  click: MousePointer,
  assert: Eye,
  api: Code,
};

const container = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const item = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.15 } } };

export default function TransactionsPage() {
  const [selectedTx, setSelectedTx] = useState<string | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);

  return (
    <motion.div className="p-6 space-y-6" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}>
        <PageHeader title="Transaction Monitoring" description="Monitor real user workflows end-to-end">
          <button
            onClick={() => setShowBuilder(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New Transaction
          </button>
        </PageHeader>
      </motion.div>

      {/* AI Prompt Bar */}
      <motion.div variants={item}>
        <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4">
          <Bot className="h-5 w-5 text-primary" />
          <input
            placeholder="Describe a transaction to monitor... e.g. 'Monitor logging into our web app and checking account balance'"
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            Generate
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Transaction List */}
        <motion.div variants={item} className="lg:col-span-3">
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-5 py-3">
              <h2 className="text-sm font-medium">Active Monitors</h2>
            </div>
            <div className="divide-y divide-border">
              {transactions.map(tx => (
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
                      <span>{tx.steps} steps</span>
                      <span>•</span>
                      <span>{tx.schedule}</span>
                      <span>•</span>
                      <span>Last: {tx.lastRun}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className={`font-mono text-sm ${tx.successRate >= 99 ? "text-success" : tx.successRate >= 97 ? "text-warning" : "text-critical"}`}>
                        {tx.successRate}%
                      </p>
                      <p className="text-xs text-muted-foreground">success</p>
                    </div>
                    <div>
                      <p className="font-mono text-sm">{tx.avgDuration}</p>
                      <p className="text-xs text-muted-foreground">avg</p>
                    </div>
                    <StatusBadge variant={tx.status}>{tx.status}</StatusBadge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Step Detail / Builder Preview */}
        <motion.div variants={item} className="lg:col-span-2">
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="text-sm font-medium">
                {selectedTx ? transactions.find(t => t.id === selectedTx)?.name : "Transaction Steps"}
              </h2>
              {selectedTx && (
                <button className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <Play className="h-3 w-3" /> Run Now
                </button>
              )}
            </div>
            <div className="p-4">
              {selectedTx ? (
                <div className="space-y-0">
                  {sampleSteps.map((step, i) => {
                    const Icon = stepIcons[step.type] || Code;
                    return (
                      <div key={step.id} className="relative">
                        {i < sampleSteps.length - 1 && (
                          <div className="absolute left-[15px] top-[32px] h-[calc(100%-8px)] w-px bg-border" />
                        )}
                        <div className="flex items-start gap-3 py-2">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            step.status === "success" ? "bg-success/10 text-success" : "bg-critical/10 text-critical"
                          }`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium">{step.label}</p>
                              <span className="font-mono text-xs text-muted-foreground">{step.duration}</span>
                            </div>
                            <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{step.detail}</p>
                          </div>
                          {step.status === "success" ? (
                            <CheckCircle className="mt-1 h-4 w-4 shrink-0 text-success" />
                          ) : (
                            <XCircle className="mt-1 h-4 w-4 shrink-0 text-critical" />
                          )}
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

      {/* Transaction Builder Modal */}
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
                  <button onClick={() => setShowBuilder(false)} className="text-muted-foreground hover:text-foreground">✕</button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Name */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Transaction Name</label>
                    <input
                      placeholder="e.g. User Login Flow"
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50"
                    />
                  </div>

                  {/* AI Generate */}
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Bot className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-primary">AI Generate Steps</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        placeholder="Describe the workflow..."
                        className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                      />
                      <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Generate</button>
                    </div>
                  </div>

                  {/* Steps */}
                  <div>
                    <h3 className="mb-3 text-sm font-medium">Steps</h3>
                    <div className="space-y-2">
                      {[
                        { icon: Globe, label: "Navigate to URL", type: "navigate" },
                        { icon: Type, label: "Input Text", type: "input" },
                        { icon: MousePointer, label: "Click Element", type: "click" },
                        { icon: Clock, label: "Wait Condition", type: "wait" },
                        { icon: Code, label: "API Request", type: "api" },
                        { icon: Eye, label: "Assertion", type: "assert" },
                      ].map(step => (
                        <button
                          key={step.type}
                          className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm transition-colors hover:bg-surface-hover hover:border-primary/30"
                        >
                          <step.icon className="h-4 w-4 text-muted-foreground" />
                          <span>{step.label}</span>
                          <Plus className="ml-auto h-4 w-4 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Schedule */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Run Schedule</label>
                    <select className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none">
                      <option>Every 1 minute</option>
                      <option>Every 5 minutes</option>
                      <option>Every 15 minutes</option>
                      <option>Every 30 minutes</option>
                      <option>Every hour</option>
                    </select>
                  </div>
                </div>
                <div className="border-t border-border px-6 py-4 flex gap-3 justify-end">
                  <button onClick={() => setShowBuilder(false)} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-surface-hover">Cancel</button>
                  <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Create Monitor</button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
