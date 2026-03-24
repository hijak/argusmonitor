import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { CalendarDays, Plus, Users, Clock3, ShieldAlert, UserPlus } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "@/components/ui/sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: api.listUsers });
  const { data: shifts = [] } = useQuery({
    queryKey: ["oncall-shifts", selectedTeamId],
    queryFn: () => api.listOnCallShifts(selectedTeamId || undefined),
  });

  const activeTeamId = selectedTeamId || teams[0]?.id || null;
  const activeTeam = teams.find((t: any) => t.id === activeTeamId) || null;
  const teamMembers = activeTeam?.members || [];
  const availableUsers = users.filter((u: any) => !teamMembers.some((m: any) => m.user_id === u.id));

  const createTeamMutation = useMutation({
    mutationFn: () => api.createOnCallTeam({ name: `Team ${teams.length + 1}`, timezone: "Europe/London", description: "On-call rotation" }),
    onSuccess: () => {
      toast.success("On-call team created");
      queryClient.invalidateQueries({ queryKey: ["oncall-teams"] });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async () => {
      const teamId = activeTeamId;
      const nextUser = availableUsers[0];
      if (!teamId) throw new Error("Create a team first");
      if (!nextUser) throw new Error("No available users to add");
      return api.addOnCallTeamMember(teamId, { user_id: nextUser.id, role: "member" });
    },
    onSuccess: () => {
      toast.success("User added to on-call team");
      queryClient.invalidateQueries({ queryKey: ["oncall-teams"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to add user"),
  });

  const createShiftMutation = useMutation({
    mutationFn: () => {
      const teamId = activeTeamId;
      const assigned = teamMembers[0]?.user;
      if (!teamId) throw new Error("Create a team first");
      if (!assigned) throw new Error("Add a team member first");
      const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1, 0, 0, 0);
      const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 8, 0, 0, 0);
      return api.createOnCallShift({
        team_id: teamId,
        user_id: assigned.id,
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
            className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Users className="h-4 w-4" /> Add Team
          </button>
          <button
            onClick={() => addMemberMutation.mutate()}
            className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <UserPlus className="h-4 w-4" /> Add User
          </button>
          <button
            onClick={() => createShiftMutation.mutate()}
            className="flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Plus className="h-4 w-4" /> Add Shift
          </button>
        </PageHeader>
      </motion.div>

      <motion.div variants={item} className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground"><Users className="h-3.5 w-3.5" /> Teams</div>
          <div className="mt-2 text-2xl font-semibold text-foreground">{teams.length}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /> Shifts</div>
          <div className="mt-2 text-2xl font-semibold text-foreground">{shifts.length}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground"><ShieldAlert className="h-3.5 w-3.5" /> Current Team</div>
          <div className="mt-2 text-lg font-semibold text-foreground">{activeTeam?.name || "None"}</div>
          <div className="mt-1 text-sm text-muted-foreground">{teamMembers.length} member{teamMembers.length === 1 ? "" : "s"}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> Timezone</div>
          <div className="mt-2 text-lg font-semibold text-foreground">{activeTeam?.timezone || "UTC"}</div>
        </div>
      </motion.div>

      <motion.div variants={item} className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="rounded-lg border border-border bg-card">
          <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-foreground">{currentMonth.toLocaleString([], { month: "long", year: "numeric" })}</h3>
              <p className="mt-1 text-sm text-muted-foreground">Calendar view of who is on call and when</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={activeTeamId || undefined} onValueChange={(value) => setSelectedTeamId(value || null)}>
                <SelectTrigger className="min-h-11 min-w-[220px]">
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team: any) => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="min-h-11 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">Prev</button>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="min-h-11 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">Next</button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-border text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="px-2 py-3">{d}</div>)}
          </div>

          <div className="grid grid-cols-7">
            {monthDays.map((day) => {
              const key = day.toISOString().slice(0, 10);
              const dayShifts = shiftMap.get(key) || [];
              const inMonth = day >= start && day <= end;
              return (
                <div key={key} className={`min-h-[122px] border-b border-r border-border p-2 align-top ${inMonth ? "bg-card" : "bg-background/40"}`}>
                  <div className={`mb-2 text-sm font-semibold ${inMonth ? "text-foreground" : "text-muted-foreground/60"}`}>{day.getDate()}</div>
                  <div className="space-y-1.5">
                    {dayShifts.slice(0, 3).map((shift: any) => (
                      <div key={shift.id} className={`rounded-md px-2 py-1.5 text-xs font-medium ${shift.escalation_level > 1 ? "bg-sky-500/15 text-sky-700 dark:text-sky-300" : "bg-primary/12 text-primary"}`}>
                        {shift.user?.name || shift.person_name}
                      </div>
                    ))}
                    {dayShifts.length > 3 && <div className="text-xs text-muted-foreground">+{dayShifts.length - 3} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border p-4">
              <h3 className="text-base font-semibold text-foreground">Team members</h3>
              <p className="mt-1 text-sm text-muted-foreground">On-call assignments now map to real users</p>
            </div>
            <div className="divide-y divide-border">
              {teamMembers.map((member: any) => (
                <div key={member.id} className="p-4">
                  <div className="text-sm font-medium text-foreground">{member.user?.name || member.user?.email || member.user_id}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{member.user?.email} · {member.role}</div>
                </div>
              ))}
              {teamMembers.length === 0 && <div className="p-4 text-sm text-muted-foreground">No users on this team yet.</div>}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border p-4">
              <h3 className="text-base font-semibold text-foreground">Upcoming coverage</h3>
              <p className="mt-1 text-sm text-muted-foreground">Next scheduled handoffs and primary coverage windows</p>
            </div>
            <div className="divide-y divide-border">
              {upcoming.map((shift: any) => (
                <div key={shift.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">{shift.user?.name || shift.person_name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{new Date(shift.start_at).toLocaleString()} → {new Date(shift.end_at).toLocaleString()}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{shift.user?.email || shift.email || "No email"}</div>
                      {shift.notes && <div className="mt-2 text-xs text-muted-foreground">{shift.notes}</div>}
                    </div>
                    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${shift.escalation_level > 1 ? "bg-sky-500/15 text-sky-700 dark:text-sky-300" : "bg-primary/12 text-primary"}`}>
                      L{shift.escalation_level}
                    </span>
                  </div>
                </div>
              ))}
              {upcoming.length === 0 && <div className="p-4 text-sm text-muted-foreground">No shifts scheduled.</div>}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
