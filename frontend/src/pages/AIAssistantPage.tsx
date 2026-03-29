import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Bot, Send, User, Zap, Server, Bell, LayoutDashboard, Loader2, Plus, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "@/components/ui/sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const quickActions = [
  { label: "Explain alert", icon: Bell },
  { label: "Create monitor", icon: Zap },
  { label: "Server health", icon: Server },
  { label: "Build dashboard", icon: LayoutDashboard },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const item = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.15 } } };

function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="argus-markdown prose prose-invert max-w-none break-words text-[14px] leading-6 prose-headings:mb-2 prose-headings:mt-5 prose-headings:break-words prose-headings:font-semibold prose-h1:text-xl prose-h2:text-base prose-h3:text-sm prose-p:my-2 prose-p:break-words prose-p:text-foreground/95 prose-ul:my-3 prose-ol:my-3 prose-li:my-1 prose-li:break-words prose-blockquote:border-l-2 prose-blockquote:border-primary/40 prose-blockquote:bg-primary/5 prose-blockquote:px-4 prose-blockquote:py-2 prose-blockquote:text-foreground/90 prose-pre:my-3 prose-pre:max-w-full prose-pre:overflow-x-auto prose-pre:rounded-xl prose-pre:border prose-pre:border-border prose-pre:bg-black/35 prose-pre:p-4 prose-code:break-words prose-code:text-foreground prose-strong:text-foreground prose-hr:border-border prose-table:my-4 prose-table:w-full prose-table:border prose-table:border-border prose-th:bg-surface/60 prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:text-xs prose-th:font-semibold prose-th:text-foreground prose-td:px-3 prose-td:py-2 prose-td:text-sm prose-td:text-foreground/90">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          code(props) {
            const { children, className, ...rest } = props;
            const inline = !className;
            if (inline) {
              return (
                <code className="break-all rounded-md bg-muted px-1.5 py-0.5 text-[12px] text-foreground" {...rest}>
                  {children}
                </code>
              );
            }
            return <code className={className} {...rest}>{children}</code>;
          },
          a(props) {
            return <a {...props} target="_blank" rel="noreferrer" className="break-all text-primary underline underline-offset-4" />;
          },
          p(props) {
            return <p className="break-words text-[14px] leading-6 text-foreground/95" {...props} />;
          },
          ul(props) {
            return <ul className="list-disc pl-5" {...props} />;
          },
          ol(props) {
            return <ol className="list-decimal pl-5" {...props} />;
          },
          blockquote(props) {
            return <blockquote className="rounded-r-lg" {...props} />;
          },
          table(props) {
            return (
              <div className="max-w-full overflow-x-auto">
                <table {...props} />
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default function AIAssistantPage() {
  const [input, setInput] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: sessions = [] } = useQuery({
    queryKey: ["ai-sessions"],
    queryFn: api.aiSessions,
  });
  const { data: preferences } = useQuery({ queryKey: ["preferences"], queryFn: api.getPreferences });

  useEffect(() => {
    if (!selectedSessionId && sessions.length > 0) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [sessions, selectedSessionId]);

  const { data: history = [] } = useQuery({
    queryKey: ["ai-history", selectedSessionId],
    queryFn: () => api.aiHistory(selectedSessionId || undefined),
    enabled: sessions.length > 0 || !!selectedSessionId,
    refetchInterval: selectedSessionId ? 5000 : false,
    refetchIntervalInBackground: true,
  });

  const createSessionMutation = useMutation({
    mutationFn: () => api.aiCreateSession(`Chat ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ["ai-sessions"] });
      setSelectedSessionId(session.id);
      toast.success("New chat created");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create chat session"),
  });

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      let sessionId = selectedSessionId;
      if (!sessionId) {
        const session = await api.aiCreateSession(message.slice(0, 60));
        sessionId = session.id;
        setSelectedSessionId(sessionId);
        queryClient.invalidateQueries({ queryKey: ["ai-sessions"] });
      }
      return api.aiChat(message, sessionId || undefined);
    },
    onSuccess: (response) => {
      if (response.session_id) setSelectedSessionId(response.session_id);
      queryClient.invalidateQueries({ queryKey: ["ai-history"] });
      queryClient.invalidateQueries({ queryKey: ["ai-sessions"] });
    },
    onError: (error: Error) => toast.error(error.message || "AI request failed"),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, chatMutation.isPending]);

  const handleSend = () => {
    if (!input.trim() || chatMutation.isPending) return;
    chatMutation.mutate(input);
    setInput("");
  };

  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const selectedSession = useMemo(() => sessions.find((s: any) => s.id === selectedSessionId), [sessions, selectedSessionId]);
  const responseStyle = preferences?.ai_response_style || 'balanced';
  const placeholder = responseStyle === 'concise' ? 'Ask briefly: explain this alert, check this host, summarise this incident…' : responseStyle === 'detailed' ? 'Ask for deeper analysis, root-cause hints, dashboard ideas, or incident summaries…' : 'Ask Vordr anything…';

  return (
    <motion.div className="flex h-full min-w-0 overflow-x-hidden" variants={container} initial="hidden" animate="show">
      <aside className="hidden w-72 shrink-0 border-r border-border bg-card/40 lg:flex lg:flex-col">
        <div className="border-b border-border p-4">
          <button
            onClick={() => createSessionMutation.mutate()}
            disabled={createSessionMutation.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {createSessionMutation.isPending ? "Creating..." : "New chat"}
          </button>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {sessions.map((session: any) => (
            <button
              key={session.id}
              onClick={() => setSelectedSessionId(session.id)}
              className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                selectedSessionId === session.id ? "border-primary/40 bg-primary/10" : "border-border bg-background hover:bg-surface-hover"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-md bg-muted p-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{session.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(session.updated_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            </button>
          ))}
          {sessions.length === 0 && <div className="px-3 py-6 text-sm text-muted-foreground">No chats yet.</div>}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
        <motion.div variants={item} className="border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <div className="space-y-3">
            <PageHeader
              title="Vordr Co-pilot"
              description={selectedSession?.title || "AI-powered monitoring assistant"}
              className="flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <button
                onClick={() => createSessionMutation.mutate()}
                disabled={createSessionMutation.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-surface-hover disabled:opacity-50 sm:w-auto lg:hidden"
              >
                <Plus className="h-4 w-4" />
                New chat
              </button>
            </PageHeader>

            <div className="lg:hidden">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Chat session</label>
              <Select value={selectedSessionId ?? "__none"} onValueChange={(value) => setSelectedSessionId(value === "__none" ? null : value)}>
                <SelectTrigger className="w-full bg-surface text-sm">
                  <SelectValue placeholder={sessions.length ? "Select chat" : "No chats yet"} />
                </SelectTrigger>
                <SelectContent className="max-w-[calc(100vw-2rem)]">
                  {sessions.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      No chats yet
                    </SelectItem>
                  ) : (
                    sessions.map((session: any) => (
                      <SelectItem key={session.id} value={session.id}>
                        {session.title}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </motion.div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 sm:px-6 sm:py-4">
          <div className="mx-auto flex w-full max-w-4xl min-w-0 flex-col gap-4">
            {history.length === 0 && !chatMutation.isPending && (
              <div className="flex min-h-[50vh] flex-col items-center justify-center px-2 text-center sm:min-h-full">
                <Bot className="mb-4 h-12 w-12 text-muted-foreground/20" />
                <p className="text-lg font-medium">How can I help?</p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">{preferences?.ai_include_context ? 'Ask about alerts, create monitors, or analyze incidents with current workspace context.' : 'Ask about alerts, create monitors, or analyze incidents.'}</p>
              </div>
            )}

            {history.map((msg: any, i: number) => (
              <motion.div key={i} variants={item} className={`flex w-full items-end gap-2 sm:gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 shadow-sm sm:flex">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={`min-w-0 max-w-[calc(100vw-3.75rem)] overflow-visible rounded-2xl text-sm shadow-sm sm:max-w-[85%] ${
                    msg.role === "user" ? "bg-primary text-primary-foreground" : "border border-border bg-card/95"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex items-center justify-between gap-2 border-b border-border/70 bg-surface/50 px-3 py-2 sm:px-4">
                      <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-foreground">
                        <Bot className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="truncate">Vordr Co-pilot</span>
                      </div>
                      <span className="hidden shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground sm:inline">markdown</span>
                    </div>
                  )}
                  <div className={`${msg.role === "user" ? "px-3 py-3 sm:px-4" : "px-3 py-3.5 sm:px-4"}`}>
                    {msg.role === "user" ? (
                      <p className="whitespace-pre-wrap break-words leading-6">{msg.content}</p>
                    ) : (
                      <MarkdownMessage content={msg.content} />
                    )}
                    <span className={`mt-3 block text-[10px] ${msg.role === "user" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                </div>
                {msg.role === "user" && (
                  <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted shadow-sm sm:flex">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </motion.div>
            ))}

            {chatMutation.isPending && (
              <div className="flex gap-2 sm:gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="rounded-xl border border-border bg-card px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="border-t border-border px-3 py-3 sm:px-6 sm:py-4">
          <div className="mx-auto flex w-full max-w-4xl min-w-0 flex-col gap-3">
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible sm:pb-0">
              {quickActions.map((a) => (
                <button
                  key={a.label}
                  onClick={() => setInput(a.label)}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                >
                  <a.icon className="h-3 w-3" />
                  {a.label}
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-border bg-surface px-3 py-3 sm:px-4">
              <div className="flex items-end gap-3">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder={placeholder}
                  className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground sm:text-sm"
                />
                <button
                  onClick={handleSend}
                  disabled={chatMutation.isPending || !input.trim()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
