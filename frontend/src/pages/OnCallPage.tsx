import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { CalendarDays, Plus, Users, Clock3, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "@/components/ui/sonner";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const item = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.15 } } };

function monthRange(base: Date) {
  const start = new Date(base.getFullYear(), base.getMonth(), 1);
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  const gridStart = new Date(start);
  gridStart.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const gridEnd = new Date(end);
  gridEnd.setDate(end.getDate() + (7 - ((end.getDay() + 6) % 7) - 1));
  return { start, end, gridStart, gridEnd };
}

export default function OnCallPage() {
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const { data: teams = [] } = useQuery({ queryKey: ["oncall-teams"], queryFn: api.listOnCallTeams });
  const { data: shifts = [] } = useQuery({
    queryKey: ["oncall-shifts", selectedTeamId],
    queryFn: () => api.listOnCallShifts(selectedTeamId || undefined),
  });

  const createTeamMutation = useMutation({
    mutationFn: () => api.createOnCallTeam({ name: `Team ${teams.length + 1}`, timezone: "Europe/London", description: "On-call rotation" }),
    onSuccess: () => {
      toast.success("On-call team created");
      queryClient.invalidateQueries({ queryKey: ["oncall-teams"] });
    },
  });

  const createShiftMutation = useMutation({
    mutationFn: () => {
      const teamId = selectedTeamId || teams[0]?.id;
      if (!teamId) throw new Error("Create a team first");
      const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1, 0, 0, 0);
      const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 8, 0, 0, 0);
      return api.createOnCallShift({
        team_id: teamId,
        person_name: `Engineer ${Math.floor(Math.random() * 90 + 10)}`,
        email: "oncall@example.com",
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        escalation_level: 1,
        notes: "Added from UI",
      });
    },
    onSuccess: () => {
      toast.success("Shift added");
      queryClient.invalidateQueries({ queryKey: ["oncall-shifts"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to add shift"),
  });

  const activeTeamId = selectedTeamId || teams[0]?.id || null;
  const activeTeam = teams.find((t: any) => t.id === activeTeamId) || null;

  const { start, end, gridStart, gridEnd } = useMemo(() => monthRange(currentMonth), [currentMonth]);
  const monthDays: Date[] = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    monthDays.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  const shiftMap = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const shift of shifts) {
      const shiftStart = new Date(shift.start_at);
      const shiftEnd = new Date(shift.end_at);
      const d = new Date(shiftStart);
      while (d < shiftEnd) {
        const key = d.toISOString().slice(0, 10);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(shift);
        d.setDate(d.getDate() + 1);
      }
    }
    return map;
  }, [shifts]);

  const upcoming = [...shifts]
    .filter((s: any) => new Date(s.end_at).getTime() >= Date.now())
    .sort((a: any, b: any) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
    .slice(0, 8);

  return (
    <motion.div className="p-6 space-y-6" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}>
        <PageHeader title="On-call" description="Rotations, calendar coverage, and who gets paged next">
          <button
            onClick={() => createTeamMutation.mutate()}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-surface-hover"
          >
            <Users className="h-4 w-4" /> Add Team
          </button>
          <button
            onClick={() => createShiftMutation.mutate()}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Add Shift
          </button>
        </PageHeader>
      </motion.div>

      <motion.div variants={item} className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground"><Users className="h-3.5 w-3.5" /> Teams</div>
          <div className="mt-2 text-2xl font-semibold">{teams.length}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /> Shifts</div>
          <div className="mt-2 text-2xl font-semibold">{shifts.length}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground"><ShieldAlert className="h-3.5 w-3.5" /> Current Team</div>
          <div className="mt-2 text-lg font-semibold">{activeTeam?.name || "None"}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> Timezone</div>
          <div className="mt-2 text-lg font-semibold">{activeTeam?.timezone || "UTC"}</div>
        </div>
      </motion.div>

      <motion.div variants={item} className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="rounded-lg border border-border bg-card">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold">{currentMonth.toLocaleString([], { month: "long", year: "numeric" })}</h3>
              <p className="text-xs text-muted-foreground">Calendar view of who is on call and when</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={activeTeamId || ""}
                onChange={(e) => setSelectedTeamId(e.target.value || null)}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {teams.map((team: any) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="rounded-md border border-border px-3 py-2 text-sm">Prev</button>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="rounded-md border border-border px-3 py-2 text-sm">Next</button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-border text-center text-[11px] uppercase tracking-wide text-muted-foreground">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="px-2 py-3">{d}</div>)}
          </div>

          <div className="grid grid-cols-7">
            {monthDays.map((day) => {
              const key = day.toISOString().slice(0, 10);
              const dayShifts = shiftMap.get(key) || [];
              const inMonth = day >= start && day <= end;
              return (
                <div key={key} className={`min-h-[110px] border-b border-r border-border p-2 align-top ${inMonth ? "bg-card" : "bg-background/40"}`}>
                  <div className={`mb-2 text-xs font-medium ${inMonth ? "text-foreground" : "text-muted-foreground/50"}`}>{day.getDate()}</div>
                  <div className="space-y-1">
                    {dayShifts.slice(0, 3).map((shift: any) => (
                      <div key={shift.id} className={`rounded px-2 py-1 text-[10px] ${shift.escalation_level > 1 ? "bg-sky-500/10 text-sky-400" : "bg-primary/10 text-primary"}`}>
                        {shift.person_name}
                      </div>
                    ))}
                    {dayShifts.length > 3 && <div className="text-[10px] text-muted-foreground">+{dayShifts.length - 3} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border p-4">
            <h3 className="text-sm font-semibold">Upcoming coverage</h3>
            <p className="text-xs text-muted-foreground">Next scheduled handoffs and primary coverage windows</p>
          </div>
          <div className="divide-y divide-border">
            {upcoming.map((shift: any) => (
              <div key={shift.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">{shift.person_name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{new Date(shift.start_at).toLocaleString()} → {new Date(shift.end_at).toLocaleString()}</div>
                    {shift.notes && <div className="mt-1 text-xs text-muted-foreground">{shift.notes}</div>}
                  </div>
                  <span className={`rounded-md px-2 py-1 text-[10px] font-medium ${shift.escalation_level > 1 ? "bg-sky-500/10 text-sky-400" : "bg-primary/10 text-primary"}`}>
                    L{shift.escalation_level}
                  </span>
                </div>
              </div>
            ))}
            {upcoming.length === 0 && <div className="p-4 text-sm text-muted-foreground">No shifts scheduled.</div>}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
