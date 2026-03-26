import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { CalendarDays, Plus, Users, Clock3, ShieldAlert, UserPlus, Pencil, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "@/components/ui/sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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

function toLocalDateTimeInput(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function TeamDialog({ open, onOpenChange, initialValues, onSubmit, pending }: any) {
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("Europe/London");
  const [description, setDescription] = useState("");

  useEffect(() => {
    setName(initialValues?.name || "");
    setTimezone(initialValues?.timezone || "Europe/London");
    setDescription(initialValues?.description || "");
  }, [initialValues, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialValues ? "Edit team" : "Create team"}</DialogTitle>
          <DialogDescription>Manage the on-call team name, timezone, and description.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team-name">Name</Label>
            <Input id="team-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Primary Ops" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="team-timezone">Timezone</Label>
            <Input id="team-timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Europe/London" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="team-description">Description</Label>
            <Textarea id="team-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Primary alert rotation" rows={3} />
          </div>
        </div>
        <DialogFooter>
          <button type="button" onClick={() => onOpenChange(false)} className="rounded-md border border-border px-4 py-2 text-sm">Cancel</button>
          <button
            type="button"
            disabled={pending || !name.trim()}
            onClick={() => onSubmit({ name: name.trim(), timezone: timezone.trim() || "UTC", description: description.trim() || null })}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {pending ? "Saving..." : initialValues ? "Save changes" : "Create team"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDeleteDialog({ open, onOpenChange, title, description, confirmLabel = "Delete", pending, onConfirm }: any) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={pending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {pending ? "Deleting..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ShiftDialog({ open, onOpenChange, teamId, teamMembers, initialValues, onSubmit, pending }: any) {
  const [userId, setUserId] = useState<string>("unassigned");
  const [personName, setPersonName] = useState("");
  const [email, setEmail] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [escalationLevel, setEscalationLevel] = useState("1");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setUserId(initialValues?.user_id || "unassigned");
    setPersonName(initialValues?.person_name || "");
    setEmail(initialValues?.email || "");
    setStartAt(toLocalDateTimeInput(initialValues?.start_at));
    setEndAt(toLocalDateTimeInput(initialValues?.end_at));
    setEscalationLevel(String(initialValues?.escalation_level || 1));
    setNotes(initialValues?.notes || "");
  }, [initialValues, open]);

  const selectedMember = teamMembers.find((member: any) => member.user_id === userId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{initialValues ? "Edit shift" : "Add shift"}</DialogTitle>
          <DialogDescription>Create or update an on-call coverage window.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Assigned member</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a team member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned / manual contact</SelectItem>
                {teamMembers.map((member: any) => (
                  <SelectItem key={member.id} value={member.user_id}>{member.user?.name || member.user?.email || member.user_id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="shift-person">Person name</Label>
            <Input id="shift-person" value={personName} onChange={(e) => setPersonName(e.target.value)} placeholder={selectedMember?.user?.name || "Ops engineer"} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shift-email">Email</Label>
            <Input id="shift-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={selectedMember?.user?.email || "oncall@example.com"} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shift-start">Start</Label>
            <Input id="shift-start" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shift-end">End</Label>
            <Input id="shift-end" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shift-level">Escalation level</Label>
            <Input id="shift-level" type="number" min={1} max={9} value={escalationLevel} onChange={(e) => setEscalationLevel(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="shift-notes">Notes</Label>
            <Textarea id="shift-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Primary rotation / backup / weekend coverage" />
          </div>
        </div>
        <DialogFooter>
          <button type="button" onClick={() => onOpenChange(false)} className="rounded-md border border-border px-4 py-2 text-sm">Cancel</button>
          <button
            type="button"
            disabled={pending || !teamId || !startAt || !endAt || !(personName.trim() || userId !== "unassigned")}
            onClick={() => onSubmit({
              team_id: teamId,
              user_id: userId === "unassigned" ? null : userId,
              person_name: personName.trim() || null,
              email: email.trim() || null,
              start_at: new Date(startAt).toISOString(),
              end_at: new Date(endAt).toISOString(),
              escalation_level: Number(escalationLevel || 1),
              notes: notes.trim() || null,
            })}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {pending ? "Saving..." : initialValues ? "Save changes" : "Create shift"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function OnCallPage() {
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<any | null>(null);
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<any | null>(null);
  const [newMemberUserId, setNewMemberUserId] = useState<string>("");
  const [newMemberRole, setNewMemberRole] = useState<string>("member");
  const [teamToDelete, setTeamToDelete] = useState<any | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<any | null>(null);
  const [shiftToDelete, setShiftToDelete] = useState<any | null>(null);

  const { data: teams = [] } = useQuery({ queryKey: ["oncall-teams"], queryFn: api.listOnCallTeams });
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: api.listUsers });
  const activeTeamId = selectedTeamId || teams[0]?.id || null;
  const activeTeam = teams.find((t: any) => t.id === activeTeamId) || null;
  const teamMembers = activeTeam?.members || [];
  const { data: shifts = [] } = useQuery({
    queryKey: ["oncall-shifts", activeTeamId],
    queryFn: () => api.listOnCallShifts(activeTeamId || undefined),
  });

  const availableUsers = users.filter((u: any) => !teamMembers.some((m: any) => m.user_id === u.id));

  useEffect(() => {
    if (!selectedTeamId && teams[0]?.id) setSelectedTeamId(teams[0].id);
  }, [teams, selectedTeamId]);

  const invalidateOnCall = () => {
    queryClient.invalidateQueries({ queryKey: ["oncall-teams"] });
    queryClient.invalidateQueries({ queryKey: ["oncall-shifts"] });
  };

  const createTeamMutation = useMutation({
    mutationFn: (payload: any) => api.createOnCallTeam(payload),
    onSuccess: (team: any) => {
      toast.success("On-call team created");
      setSelectedTeamId(team.id);
      setTeamDialogOpen(false);
      invalidateOnCall();
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create team"),
  });

  const updateTeamMutation = useMutation({
    mutationFn: (payload: any) => api.updateOnCallTeam(editingTeam.id, payload),
    onSuccess: () => {
      toast.success("Team updated");
      setEditingTeam(null);
      setTeamDialogOpen(false);
      invalidateOnCall();
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update team"),
  });

  const deleteTeamMutation = useMutation({
    mutationFn: (teamId: string) => api.deleteOnCallTeam(teamId),
    onSuccess: () => {
      toast.success("Team deleted");
      setTeamToDelete(null);
      setSelectedTeamId(null);
      invalidateOnCall();
    },
    onError: (error: Error) => toast.error(error.message || "Failed to delete team"),
  });

  const addMemberMutation = useMutation({
    mutationFn: (payload: any) => api.addOnCallTeamMember(activeTeamId, payload),
    onSuccess: () => {
      toast.success("User added to team");
      setNewMemberUserId("");
      setNewMemberRole("member");
      invalidateOnCall();
    },
    onError: (error: Error) => toast.error(error.message || "Failed to add user"),
  });

  const updateMemberMutation = useMutation({
    mutationFn: ({ memberId, role }: any) => api.updateOnCallTeamMember(activeTeamId, memberId, { role }),
    onSuccess: () => {
      toast.success("Member updated");
      invalidateOnCall();
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update member"),
  });

  const deleteMemberMutation = useMutation({
    mutationFn: (memberId: string) => api.deleteOnCallTeamMember(activeTeamId, memberId),
    onSuccess: () => {
      toast.success("Member removed");
      setMemberToDelete(null);
      invalidateOnCall();
    },
    onError: (error: Error) => toast.error(error.message || "Failed to remove member"),
  });

  const createShiftMutation = useMutation({
    mutationFn: (payload: any) => api.createOnCallShift(payload),
    onSuccess: () => {
      toast.success("Shift created");
      setEditingShift(null);
      setShiftDialogOpen(false);
      invalidateOnCall();
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create shift"),
  });

  const updateShiftMutation = useMutation({
    mutationFn: (payload: any) => api.updateOnCallShift(editingShift.id, payload),
    onSuccess: () => {
      toast.success("Shift updated");
      setEditingShift(null);
      setShiftDialogOpen(false);
      invalidateOnCall();
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update shift"),
  });

  const deleteShiftMutation = useMutation({
    mutationFn: (shiftId: string) => api.deleteOnCallShift(shiftId),
    onSuccess: () => {
      toast.success("Shift deleted");
      setShiftToDelete(null);
      invalidateOnCall();
    },
    onError: (error: Error) => toast.error(error.message || "Failed to delete shift"),
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
            onClick={() => {
              setEditingTeam(null);
              setTeamDialogOpen(true);
            }}
            className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-hover"
          >
            <Users className="h-4 w-4" /> New Team
          </button>
          <button
            onClick={() => {
              setEditingShift(null);
              setShiftDialogOpen(true);
            }}
            disabled={!activeTeamId}
            className="flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
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
              {activeTeam && (
                <>
                  <button onClick={() => { setEditingTeam(activeTeam); setTeamDialogOpen(true); }} className="min-h-11 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-hover"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => setTeamToDelete(activeTeam)} className="min-h-11 rounded-md border border-border px-3 py-2 text-sm font-medium text-critical hover:bg-surface-hover"><Trash2 className="h-4 w-4" /></button>
                </>
              )}
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="min-h-11 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-hover">Prev</button>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="min-h-11 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-hover">Next</button>
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
                      <button key={shift.id} onClick={() => { setEditingShift(shift); setShiftDialogOpen(true); }} className={`block w-full rounded-md px-2 py-1.5 text-left text-xs font-medium ${shift.escalation_level > 1 ? "bg-sky-500/15 text-sky-700 dark:text-sky-300" : "bg-primary/12 text-primary"}`}>
                        {shift.user?.name || shift.person_name}
                      </button>
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
              <p className="mt-1 text-sm text-muted-foreground">Edit roles and remove members directly from the roster.</p>
            </div>
            <div className="border-b border-border p-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
                <Select value={newMemberUserId || undefined} onValueChange={setNewMemberUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((user: any) => <SelectItem key={user.id} value={user.id}>{user.name || user.email}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={newMemberRole} onValueChange={setNewMemberRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="primary">Primary</SelectItem>
                    <SelectItem value="secondary">Secondary</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  onClick={() => addMemberMutation.mutate({ user_id: newMemberUserId, role: newMemberRole })}
                  disabled={!activeTeamId || !newMemberUserId || addMemberMutation.isPending}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium disabled:opacity-50"
                >
                  <UserPlus className="h-4 w-4" /> Add
                </button>
              </div>
            </div>
            <div className="divide-y divide-border">
              {teamMembers.map((member: any) => (
                <div key={member.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <div className="text-sm font-medium text-foreground">{member.user?.name || member.user?.email || member.user_id}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{member.user?.email || "No email"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={member.role} onValueChange={(role) => updateMemberMutation.mutate({ memberId: member.id, role })}>
                      <SelectTrigger className="min-w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lead">Lead</SelectItem>
                        <SelectItem value="primary">Primary</SelectItem>
                        <SelectItem value="secondary">Secondary</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                      </SelectContent>
                    </Select>
                    <button onClick={() => setMemberToDelete(member)} className="rounded-md border border-border px-3 py-2 text-critical hover:bg-surface-hover"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
              {teamMembers.length === 0 && <div className="p-4 text-sm text-muted-foreground">No users on this team yet.</div>}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border p-4">
              <h3 className="text-base font-semibold text-foreground">Upcoming coverage</h3>
              <p className="mt-1 text-sm text-muted-foreground">Edit or delete the next scheduled handoffs.</p>
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
                    <div className="flex items-center gap-2">
                      <span className={`rounded-md px-2 py-1 text-xs font-semibold ${shift.escalation_level > 1 ? "bg-sky-500/15 text-sky-700 dark:text-sky-300" : "bg-primary/12 text-primary"}`}>
                        L{shift.escalation_level}
                      </span>
                      <button onClick={() => { setEditingShift(shift); setShiftDialogOpen(true); }} className="rounded-md border border-border px-3 py-2 hover:bg-surface-hover"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => setShiftToDelete(shift)} className="rounded-md border border-border px-3 py-2 text-critical hover:bg-surface-hover"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
              {upcoming.length === 0 && <div className="p-4 text-sm text-muted-foreground">No shifts scheduled.</div>}
            </div>
          </div>
        </div>
      </motion.div>

      <TeamDialog
        open={teamDialogOpen}
        onOpenChange={(open: boolean) => {
          setTeamDialogOpen(open);
          if (!open) setEditingTeam(null);
        }}
        initialValues={editingTeam}
        pending={createTeamMutation.isPending || updateTeamMutation.isPending}
        onSubmit={(payload: any) => editingTeam ? updateTeamMutation.mutate(payload) : createTeamMutation.mutate(payload)}
      />

      <ShiftDialog
        open={shiftDialogOpen}
        onOpenChange={(open: boolean) => {
          setShiftDialogOpen(open);
          if (!open) setEditingShift(null);
        }}
        teamId={activeTeamId}
        teamMembers={teamMembers}
        initialValues={editingShift}
        pending={createShiftMutation.isPending || updateShiftMutation.isPending}
        onSubmit={(payload: any) => editingShift ? updateShiftMutation.mutate(payload) : createShiftMutation.mutate(payload)}
      />

      <ConfirmDeleteDialog
        open={!!teamToDelete}
        onOpenChange={(open: boolean) => !open && setTeamToDelete(null)}
        title="Delete on-call team?"
        description={teamToDelete ? `This will remove ${teamToDelete.name} and all of its shifts. This cannot be undone.` : ""}
        pending={deleteTeamMutation.isPending}
        onConfirm={() => teamToDelete && deleteTeamMutation.mutate(teamToDelete.id)}
      />

      <ConfirmDeleteDialog
        open={!!memberToDelete}
        onOpenChange={(open: boolean) => !open && setMemberToDelete(null)}
        title="Remove team member?"
        description={memberToDelete ? `Remove ${memberToDelete.user?.name || memberToDelete.user?.email || "this member"} from the current on-call team.` : ""}
        confirmLabel="Remove"
        pending={deleteMemberMutation.isPending}
        onConfirm={() => memberToDelete && deleteMemberMutation.mutate(memberToDelete.id)}
      />

      <ConfirmDeleteDialog
        open={!!shiftToDelete}
        onOpenChange={(open: boolean) => !open && setShiftToDelete(null)}
        title="Delete shift?"
        description={shiftToDelete ? `Delete the shift for ${shiftToDelete.user?.name || shiftToDelete.person_name} starting ${new Date(shiftToDelete.start_at).toLocaleString()}.` : ""}
        pending={deleteShiftMutation.isPending}
        onConfirm={() => shiftToDelete && deleteShiftMutation.mutate(shiftToDelete.id)}
      />
    </motion.div>
  );
}
