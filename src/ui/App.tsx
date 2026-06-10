import { addDays, format } from "date-fns";
import {
  CalendarDays,
  Check,
  Clock,
  Copy,
  Download,
  Globe2,
  Languages,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Save,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import type {
  AdminMeetingsView,
  CreateMeetingRequest,
  Language,
  MeetingData,
  OrganizerCalendar,
  OrganizerMeetingView,
  ParticipantMeetingView,
  Proposal,
  ProposalResult,
} from "../shared/domain";
import { formatPin, normalizePin } from "../shared/domain";
import { addMinutesIso, formatDateTime, getBrowserTimeZone, getSupportedTimeZones, utcIsoToZonedParts, zonedWallTimeToUtcIso } from "../shared/time";
import { api } from "./api";
import { Button } from "./components/Button";
import { claim, initialLanguage, useTexts } from "./i18n";
import { cn } from "./lib";

type Route =
  | { name: "new" }
  | { name: "admin" }
  | { name: "participant"; meetingId: string }
  | { name: "organizer"; meetingId: string; editId: string };

function parseRoute(): Route {
  const parts = window.location.pathname.replace(/^\/+|\/+$/g, "").split("/");
  if (parts[0] === "admin") return { name: "admin" };
  if (parts[0] === "m" && parts[1] && parts[2] === "edit" && parts[3]) {
    return { name: "organizer", meetingId: parts[1], editId: parts[3] };
  }
  if (parts[0] === "m" && parts[1]) return { name: "participant", meetingId: parts[1] };
  return { name: "new" };
}

function defaultCalendar(): OrganizerCalendar {
  const maxDate = format(addDays(new Date(), 28), "yyyy-MM-dd");
  return { maxDate, dayStart: "09:00", dayEnd: "16:00", includeWeekends: false };
}

function emptyMeeting(): CreateMeetingRequest {
  return {
    title: "",
    description: "",
    durationMinutes: 60,
    participantPin: undefined,
    editorTimeZone: getBrowserTimeZone(),
    organizerCalendar: defaultCalendar(),
    proposals: [],
  };
}

function newPin(): string {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}

export function App() {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const route = parseRoute();
  const t = useTexts(language);

  function changeLanguage(next: Language) {
    localStorage.setItem("letsmeet.language", next);
    setLanguage(next);
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div>
            <div className="text-2xl font-semibold tracking-normal">LetsMeet</div>
            <div className="text-sm text-muted-foreground">{claim}</div>
          </div>
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4 text-muted-foreground" />
            <select
              className="h-9 rounded-md border border-input bg-white px-2 text-sm"
              value={language}
              onChange={(event) => changeLanguage(event.target.value as Language)}
            >
              <option value="en">English</option>
              <option value="de">Deutsch</option>
            </select>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6">
        {route.name === "new" && <MeetingEditor language={language} mode="create" />}
        {route.name === "admin" && <AdminView language={language} />}
        {route.name === "organizer" && <OrganizerView language={language} meetingId={route.meetingId} editId={route.editId} />}
        {route.name === "participant" && <ParticipantView language={language} meetingId={route.meetingId} />}
      </main>
    </div>
  );
}

function MeetingEditor({
  language,
  mode,
  initial,
  meetingId,
  editId,
  proposalResults,
  onSaved,
}: {
  language: Language;
  mode: "create" | "update";
  initial?: MeetingData;
  meetingId?: string;
  editId?: string;
  proposalResults?: ProposalResult[];
  onSaved?: () => void;
}) {
  const t = useTexts(language);
  const [draft, setDraft] = useState<CreateMeetingRequest>(() => initial ?? emptyMeeting());
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [detailsCollapsed, setDetailsCollapsed] = useState(false);
  const canSaveMeeting = draft.title.trim().length > 0 && draft.proposals.length > 0 && !busy;

  useEffect(() => {
    if (initial) setDraft(initial);
  }, [initial]);

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const participantPin = draft.participantPin ? normalizePin(draft.participantPin) : undefined;
      const body = { ...draft, participantPin };
      const saved =
        mode === "create"
          ? await api.createMeeting(body)
          : await api.updateMeeting(meetingId!, { ...body, editId: editId! });
      if (mode === "create") {
        window.history.pushState(null, "", `/m/${saved.id}/edit/${saved.editId}`);
        window.location.reload();
      } else {
        onSaved?.();
        setMessage(t.copied);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("grid gap-5", detailsCollapsed ? "lg:grid-cols-[52px_1fr]" : "lg:grid-cols-[360px_1fr]")}>
      <section className={cn("rounded-lg border border-border bg-card", detailsCollapsed ? "p-2" : "p-4")}>
        <div className={cn("mb-4 flex items-center justify-between gap-2", detailsCollapsed && "mb-0 justify-end")}>
          {!detailsCollapsed && (
            <div className="flex min-w-0 items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold">{t.meetingDetails}</h1>
            </div>
          )}
          <Button
            size="icon"
            variant="ghost"
            title={detailsCollapsed ? t.showDetails : t.hideDetails}
            onClick={() => setDetailsCollapsed(!detailsCollapsed)}
          >
            {detailsCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>
        {!detailsCollapsed && <div className="space-y-4">
          <Field label={t.title}>
            <input className="w-full rounded-md border border-input px-3 py-2" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </Field>
          <Field label={t.description}>
            <textarea
              className="min-h-24 w-full rounded-md border border-input px-3 py-2"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </Field>
          <Field label={t.duration}>
            <select
              className="w-full rounded-md border border-input px-3 py-2"
              value={draft.durationMinutes}
              onChange={(e) => setDraft({ ...draft, durationMinutes: Number(e.target.value) })}
            >
              {durationOptions().map((minutes) => (
                <option key={minutes} value={minutes}>
                  {formatDuration(minutes, language)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t.participantPin}>
            <div className="flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-md border border-input px-3 py-2"
                value={draft.participantPin ? formatPin(draft.participantPin) : ""}
                onChange={(e) => setDraft({ ...draft, participantPin: normalizePin(e.target.value) || undefined })}
              />
              <Button type="button" size="icon" title={t.generatePin} onClick={() => setDraft({ ...draft, participantPin: newPin() })}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </Field>
          <div className="border-t border-border pt-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Clock className="h-4 w-4 text-primary" />
              {t.calendarRange}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t.maxDate}>
                <input
                  type="date"
                  className="w-full rounded-md border border-input px-3 py-2"
                  value={draft.organizerCalendar.maxDate}
                  onChange={(e) => setDraft({ ...draft, organizerCalendar: { ...draft.organizerCalendar, maxDate: e.target.value } })}
                />
              </Field>
              <Field label={t.timeZone}>
                <TimeZonePicker
                  value={draft.editorTimeZone}
                  onChange={(timeZone) => setDraft({ ...draft, editorTimeZone: timeZone })}
                  language={language}
                />
              </Field>
              <Field label={t.dayStart}>
                <input
                  type="time"
                  step={900}
                  className="w-full rounded-md border border-input px-3 py-2"
                  value={draft.organizerCalendar.dayStart}
                  onChange={(e) => setDraft({ ...draft, organizerCalendar: { ...draft.organizerCalendar, dayStart: e.target.value } })}
                />
              </Field>
              <Field label={t.dayEnd}>
                <input
                  type="time"
                  step={900}
                  className="w-full rounded-md border border-input px-3 py-2"
                  value={draft.organizerCalendar.dayEnd}
                  onChange={(e) => setDraft({ ...draft, organizerCalendar: { ...draft.organizerCalendar, dayEnd: e.target.value } })}
                />
              </Field>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.organizerCalendar.includeWeekends}
                onChange={(e) => setDraft({ ...draft, organizerCalendar: { ...draft.organizerCalendar, includeWeekends: e.target.checked } })}
              />
              {t.includeWeekends}
            </label>
          </div>
          {message && <div className="rounded-md bg-muted px-3 py-2 text-sm">{message}</div>}
        </div>}
      </section>

      <section className="min-w-0 rounded-lg border border-border bg-card p-4">
        <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <p className="whitespace-pre-line text-sm text-muted-foreground">{t.addProposalHint}</p>
          <Button size="sm" variant="primary" disabled={!canSaveMeeting} onClick={save}>
            <Save className="h-4 w-4" />
            {mode === "create" ? t.save : t.update}
          </Button>
        </div>
        <OrganizerCalendarGrid language={language} draft={draft} setDraft={setDraft} proposalResults={proposalResults} />
      </section>
    </div>
  );
}

function OrganizerCalendarGrid({
  language,
  draft,
  setDraft,
  proposalResults,
}: {
  language: Language;
  draft: CreateMeetingRequest;
  setDraft: (draft: CreateMeetingRequest) => void;
  proposalResults?: ProposalResult[];
}) {
  const days = calendarDays(draft.organizerCalendar.maxDate, draft.organizerCalendar.includeWeekends, language);
  const slots = timeSlots(draft.organizerCalendar.dayStart, draft.organizerCalendar.dayEnd);
  const proposalResultById = new Map((proposalResults ?? []).map((result) => [result.id, result]));
  const proposalNumbers = new Map(
    [...draft.proposals]
      .sort((a, b) => a.startsAtUtc.localeCompare(b.startsAtUtc))
      .map((proposal, index) => [proposal.id, index + 1]),
  );

  function toggle(date: string, time: string) {
    const startsAtUtc = zonedWallTimeToUtcIso(date, time, draft.editorTimeZone);
    const coveredProposal = findCoveringProposal(draft.proposals, startsAtUtc, draft.durationMinutes);
    const wouldOverlap = hasOverlappingProposal(draft.proposals, startsAtUtc, draft.durationMinutes);
    const proposals = coveredProposal
      ? draft.proposals.filter((proposal) => proposal.id !== coveredProposal.id)
      : wouldOverlap
        ? draft.proposals
        : [...draft.proposals, { id: crypto.randomUUID(), startsAtUtc }];
    setDraft({ ...draft, proposals });
  }

  return (
    <div className="overflow-auto">
      <div className="calendar-grid grid min-w-max gap-px" style={{ "--day-count": days.length } as CSSProperties}>
        <div className="sticky left-0 z-10 bg-card" />
        {days.map((day) => (
          <div
            key={day.date}
            className={cn(
              "border-l border-border bg-muted px-3 py-2 text-sm font-medium",
              day.isWeekend && "bg-accent/20",
              day.isMonday && "border-l-4 border-l-primary",
            )}
          >
            {day.label}
          </div>
        ))}
        {slots.map((time) => (
          <Row
            key={time}
            time={time}
            days={days}
            draft={draft}
            proposalResultById={proposalResultById}
            proposalNumbers={proposalNumbers}
            onToggle={toggle}
          />
        ))}
      </div>
    </div>
  );
}

function Row({
  time,
  days,
  draft,
  proposalResultById,
  proposalNumbers,
  onToggle,
}: {
  time: string;
  days: { date: string; label: string; isWeekend: boolean; isMonday: boolean }[];
  draft: CreateMeetingRequest;
  proposalResultById: Map<string, ProposalResult>;
  proposalNumbers: Map<string, number>;
  onToggle: (date: string, time: string) => void;
}) {
  return (
    <>
      <div className="sticky left-0 z-10 border-t border-border bg-card px-2 py-2 text-xs text-muted-foreground">{time}</div>
      {days.map((day) => {
        const startsAtUtc = zonedWallTimeToUtcIso(day.date, time, draft.editorTimeZone);
        const proposal = findCoveringProposal(draft.proposals, startsAtUtc, draft.durationMinutes);
        const isProposalStart = proposal?.startsAtUtc === startsAtUtc;
        const proposalResult = proposal ? proposalResultById.get(proposal.id) : undefined;
        const outsideDate = day.date > draft.organizerCalendar.maxDate;
        const startFitsDuration = slotFitsDuration(time, draft.durationMinutes, draft.organizerCalendar.dayEnd);
        return (
          <button
            key={`${day.date}-${time}`}
            type="button"
            disabled={outsideDate || (!proposal && !startFitsDuration)}
            className={cn(
              "h-9 border-l border-t border-border px-1 text-xs transition hover:bg-accent/20 disabled:bg-muted/40",
              day.isWeekend && "bg-accent/10",
              day.isMonday && "border-l-4 border-l-primary",
              proposal && "bg-primary/75 text-primary-foreground hover:bg-primary/85",
              isProposalStart && "bg-primary hover:bg-primary/90",
            )}
            onClick={() => onToggle(day.date, time)}
          >
            {isProposalStart && proposal ? (
              <span className="flex items-center justify-center gap-1 truncate">
                <Check className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  Vorschlag #{proposalNumbers.get(proposal.id)}
                  {proposalResult ? ` · ${proposalResult.approvalCount}/${proposalResult.approvedBy.length + proposalResult.declinedBy.length}` : ""}
                </span>
              </span>
            ) : null}
          </button>
        );
      })}
    </>
  );
}

function OrganizerView({ language, meetingId, editId }: { language: Language; meetingId: string; editId: string }) {
  const t = useTexts(language);
  const [view, setView] = useState<OrganizerMeetingView | null>(null);
  const [error, setError] = useState("");
  const [organizerMode, setOrganizerMode] = useState<"propose" | "evaluate">("evaluate");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletedTitle, setDeletedTitle] = useState<string | null>(null);
  const deleteButtonRef = useRef<HTMLButtonElement | null>(null);
  const deletingRef = useRef(false);

  async function load() {
    try {
      setView(await api.getOrganizerMeeting(meetingId, editId));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.meetingNotFound);
    }
  }

  useEffect(() => {
    void load();
  }, [meetingId, editId]);

  useEffect(() => {
    if (view?.meeting.closedAt) setOrganizerMode("evaluate");
  }, [view?.meeting.closedAt]);

  useEffect(() => {
    if (!confirmingDelete) return;
    const handle = window.setTimeout(() => setConfirmingDelete(false), 3000);
    const onPointerDown = (event: PointerEvent) => {
      if (!deleteButtonRef.current?.contains(event.target as Node)) setConfirmingDelete(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.clearTimeout(handle);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [confirmingDelete]);

  async function handleDeleteClick() {
    if (deletedTitle !== null) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    if (deletingRef.current) return;
    deletingRef.current = true;
    try {
      const title = view?.meeting.data.title ?? "";
      await api.deleteMeeting(meetingId, editId);
      setConfirmingDelete(false);
      setDeletedTitle(title);
      window.setTimeout(() => window.location.assign("/"), 2000);
    } catch (err) {
      deletingRef.current = false;
      setConfirmingDelete(false);
      setError(err instanceof Error ? err.message : t.meetingNotFound);
    }
  }

  if (deletedTitle !== null) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="rounded-lg border border-border bg-card px-6 py-5 text-base font-medium shadow-xl">
          {language === "de" ? `Veranstaltung „${deletedTitle}“ gelöscht` : `Meeting “${deletedTitle}” deleted`}
        </div>
      </div>
    );
  }

  if (error) return <StateMessage title={t.meetingNotFound} detail={error} />;
  if (!view) return <StateMessage title="LetsMeet" detail="Loading" />;

  const votingLink = `${window.location.origin}/m/${meetingId}`;
  const editLink = `${window.location.origin}/m/${meetingId}/edit/${editId}`;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{view.meeting.data.title}</h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              {view.knownParticipantCount} {t.participants}
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          <CopyLine label={t.votingLink} value={votingLink} />
          <CopyLine label={t.editLink} value={editLink} />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-full border border-border bg-muted p-1">
            {!view.meeting.closedAt && (
              <ViewChip
                active={organizerMode === "propose"}
                onClick={() => setOrganizerMode("propose")}
              >
                {t.proposeMode}
              </ViewChip>
            )}
            <ViewChip
              active={organizerMode === "evaluate"}
              onClick={() => setOrganizerMode("evaluate")}
            >
              {t.evaluateMode}
            </ViewChip>
          </div>
          <div className="flex items-center gap-2">
            {!view.meeting.closedAt && organizerMode === "evaluate" && (
              <Button variant="primary" onClick={() => api.closeVoting(meetingId, editId).then(load)}>
                <Lock className="h-4 w-4" />
                {t.closeVoting}
              </Button>
            )}
            <button
              ref={deleteButtonRef}
              type="button"
              onClick={handleDeleteClick}
              title={confirmingDelete ? t.confirmDelete : t.deleteMeeting}
              aria-label={confirmingDelete ? t.confirmDelete : t.deleteMeeting}
              className={cn(
                "inline-flex h-9 items-center gap-1 rounded-md border px-3 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-ring",
                confirmingDelete
                  ? "border-red-500 bg-red-500 text-white hover:bg-red-600"
                  : "border-border text-muted-foreground hover:border-red-300 hover:bg-red-50 hover:text-red-600",
              )}
            >
              <Trash2 className="h-4 w-4" />
              {confirmingDelete && <span className="font-bold">?</span>}
            </button>
          </div>
        </div>
      </div>

      {organizerMode === "propose" && !view.meeting.closedAt ? (
        <>
          <MeetingEditor
            language={language}
            mode="update"
            initial={view.meeting.data}
            meetingId={meetingId}
            editId={editId}
            proposalResults={view.proposalResults}
            onSaved={load}
          />
        </>
      ) : organizerMode === "propose" && view.meeting.closedAt ? (
        <StateMessage title={t.votingClosed} detail={t.finalDates} />
      ) : (
        <OrganizerFeedbackCalendar language={language} view={view} meetingId={meetingId} editId={editId} onSaved={load} />
      )}
    </div>
  );
}

function ViewChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "h-8 rounded-full px-4 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-ring",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
      )}
      type="button"
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function OrganizerFeedbackCalendar({
  language,
  view,
  meetingId,
  editId,
  onSaved,
}: {
  language: Language;
  view: OrganizerMeetingView;
  meetingId: string;
  editId: string;
  onSaved: () => void;
}) {
  const t = useTexts(language);
  const [selectedFinalIds, setSelectedFinalIds] = useState(view.meeting.data.finalProposalIds);
  const [detailProposalId, setDetailProposalId] = useState<string | null>(null);
  const [detailAnchor, setDetailAnchor] = useState<DOMRect | null>(null);
  const [busySavingFinals, setBusySavingFinals] = useState(false);
  const [toast, setToast] = useState("");
  const closed = Boolean(view.meeting.closedAt);
  const detailResult = detailProposalId ? view.proposalResults.find((result) => result.id === detailProposalId) : undefined;
  const finalProposals = view.meeting.data.proposals.filter((proposal) => selectedFinalIds.includes(proposal.id));
  const savedFinalProposals = view.meeting.data.proposals.filter((proposal) => view.meeting.data.finalProposalIds.includes(proposal.id));
  const hasSavedFinalDates = savedFinalProposals.length > 0;

  useEffect(() => {
    setSelectedFinalIds(view.meeting.data.finalProposalIds);
  }, [view.meeting.data.finalProposalIds]);

  async function saveFinalDates(finalProposalIds: string[]) {
    setBusySavingFinals(true);
    try {
      await api.setFinalProposals(meetingId, { editId, finalProposalIds });
      await onSaved();
      showToast(t.finalDatesSaved);
    } catch (error) {
      setSelectedFinalIds(view.meeting.data.finalProposalIds);
      showToast(error instanceof Error ? error.message : "Error");
    } finally {
      setBusySavingFinals(false);
    }
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  function copyFinalDates() {
    const text = [
      view.meeting.data.title,
      "",
      ...finalProposals.map((proposal) => `- ${formatDateTime(proposal.startsAtUtc, language, view.meeting.data.editorTimeZone)}`),
    ].join("\n");
    void navigator.clipboard.writeText(text);
    showToast(t.copied);
  }

  function toggleFinal(proposalId: string) {
    if (busySavingFinals) return;
    const nextFinalIds = selectedFinalIds.includes(proposalId)
      ? selectedFinalIds.filter((id) => id !== proposalId)
      : [...selectedFinalIds, proposalId];
    setSelectedFinalIds(nextFinalIds);
    void saveFinalDates(nextFinalIds);
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      {toast && (
        <div className="fixed right-5 top-5 z-50 rounded-md border border-border bg-card px-4 py-3 text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          {closed ? (
            <p className="max-w-2xl text-sm text-muted-foreground">{t.finalSelectionInstruction}</p>
          ) : (
            <>
              <h2 className="text-lg font-semibold">{t.currentResults}</h2>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                {view.knownParticipantCount} {t.participants}
              </div>
            </>
          )}
        </div>
      </div>
      <div className={cn("grid gap-4", closed && "xl:grid-cols-[minmax(0,1fr)_320px]")}>
        <OrganizerFeedbackGrid
          language={language}
          view={view}
          selectedFinalIds={selectedFinalIds}
          onOpenDetails={(proposalId, anchor) => {
            setDetailProposalId((currentProposalId) => {
              if (currentProposalId === proposalId) {
                setDetailAnchor(null);
                return null;
              }

              setDetailAnchor(anchor);
              return proposalId;
            });
          }}
        />
        {closed && (
          <div className="rounded-lg border border-border bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold">{t.finalDates}</h3>
              {finalProposals.length > 0 && (
                <div className="flex shrink-0 gap-1.5">
                  <Button size="icon" className="h-8 w-8" title={t.copyResult} onClick={copyFinalDates}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  {hasSavedFinalDates && (
                    <a href={`/api/meetings/${meetingId}/final.ics`}>
                      <Button size="sm" className="h-8 px-2" title={t.downloadIcs}>
                        <Download className="h-3.5 w-3.5" />
                        .ics
                      </Button>
                    </a>
                  )}
                </div>
              )}
            </div>
            {finalProposals.length === 0 ? (
              <div className="text-sm text-muted-foreground">{t.noFinalDates}</div>
            ) : (
              <div className="grid gap-2">
                {finalProposals.map((proposal) => (
                  <div key={proposal.id} className="rounded-md border border-border bg-muted px-3 py-2 text-sm font-medium">
                    {formatDateTime(proposal.startsAtUtc, language, view.meeting.data.editorTimeZone)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {detailResult && detailAnchor && (
        <ProposalDetailsOverlay
          language={language}
          result={detailResult}
          proposalNumber={proposalNumberFor(view.meeting.data.proposals, detailResult.id)}
          participantNames={view.votes.map((vote) => vote.data.participantName)}
          isFinal={selectedFinalIds.includes(detailResult.id)}
          canToggleFinal={closed}
          anchor={detailAnchor}
          onToggleFinal={() => toggleFinal(detailResult.id)}
          onClose={() => {
            setDetailProposalId(null);
            setDetailAnchor(null);
          }}
        />
      )}
    </section>
  );
}

function OrganizerFeedbackGrid({
  language,
  view,
  selectedFinalIds,
  onOpenDetails,
}: {
  language: Language;
  view: OrganizerMeetingView;
  selectedFinalIds: string[];
  onOpenDetails: (proposalId: string, anchor: DOMRect) => void;
}) {
  const zone = view.meeting.data.editorTimeZone;
  const days = participantCalendarDays(view.meeting.data.proposals, zone, language);
  const slots = participantTimeSlots(view.meeting.data.proposals, view.meeting.data.durationMinutes, zone);
  const resultById = new Map(view.proposalResults.map((result) => [result.id, result]));
  const proposalNumbers = new Map(
    [...view.meeting.data.proposals]
      .sort((a, b) => a.startsAtUtc.localeCompare(b.startsAtUtc))
      .map((proposal, index) => [proposal.id, index + 1]),
  );

  return (
    <div className="overflow-auto">
      <div className="calendar-grid grid min-w-max gap-px" style={{ "--day-count": days.length } as CSSProperties}>
        <div className="sticky left-0 z-10 bg-card" />
        {days.map((day) => (
          <div
            key={day.date}
            className={cn(
              "border-l border-border bg-muted px-3 py-2 text-sm font-medium",
              day.isWeekend && "bg-accent/20",
              day.isMonday && "border-l-4 border-l-primary",
            )}
          >
            {day.label}
          </div>
        ))}
        {slots.map((time) => (
          <OrganizerFeedbackRow
            key={time}
            time={time}
            days={days}
            view={view}
            resultById={resultById}
            proposalNumbers={proposalNumbers}
            selectedFinalIds={selectedFinalIds}
            zone={zone}
            onOpenDetails={onOpenDetails}
          />
        ))}
      </div>
    </div>
  );
}

function OrganizerFeedbackRow({
  time,
  days,
  view,
  resultById,
  proposalNumbers,
  selectedFinalIds,
  zone,
  onOpenDetails,
}: {
  time: string;
  days: { date: string; label: string; isWeekend: boolean; isMonday: boolean }[];
  view: OrganizerMeetingView;
  resultById: Map<string, ProposalResult>;
  proposalNumbers: Map<string, number>;
  selectedFinalIds: string[];
  zone: string;
  onOpenDetails: (proposalId: string, anchor: DOMRect) => void;
}) {
  return (
    <>
      <div className="sticky left-0 z-10 h-8 border-t border-border bg-card px-2 py-1 text-xs text-muted-foreground">{time}</div>
      {days.map((day) => {
        const startsAtUtc = zonedWallTimeToUtcIso(day.date, time, zone);
        const proposal = findCoveringProposal(view.meeting.data.proposals, startsAtUtc, view.meeting.data.durationMinutes);
        const isProposalStart = proposal?.startsAtUtc === startsAtUtc;
        const result = proposal ? resultById.get(proposal.id) : undefined;
        const isFinal = proposal ? selectedFinalIds.includes(proposal.id) : false;
        const participantTotal = result ? result.approvedBy.length + result.declinedBy.length : 0;

        return (
          <div
            key={`${day.date}-${time}`}
            className={cn(
              "h-8 border-l border-t border-border px-2 text-left text-xs transition",
              day.isWeekend && "bg-accent/10",
              day.isMonday && "border-l-4 border-l-primary",
              proposal && "border-slate-500 shadow-inner",
              !proposal && "bg-white",
              isFinal && "ring-2 ring-accent ring-inset",
            )}
            style={proposal ? feedbackCellStyle(result?.approvalRatio ?? 0, isFinal) : undefined}
          >
            {isProposalStart && proposal && result ? (
              <span className="block min-w-0">
                <button
                  type="button"
                  className="block w-full cursor-pointer rounded-sm text-left hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/80"
                  onClick={(event) => onOpenDetails(proposal.id, event.currentTarget.getBoundingClientRect())}
                >
                <span className="flex items-center justify-between gap-2 px-1 font-semibold">
                  <span className="truncate">Vorschlag #{proposalNumbers.get(proposal.id)}</span>
                  <span className="shrink-0">
                    {result.approvalCount}/{participantTotal} ({Math.round(result.approvalRatio * 100)}%)
                  </span>
                </span>
                <span className="mx-1 mt-1 block h-2 rounded-full bg-white/80">
                  <span className="block h-2 rounded-full bg-amber-400" style={{ width: `${result.approvalRatio * 100}%` }} />
                </span>
                </button>
              </span>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

function ProposalDetailsOverlay({
  language,
  result,
  proposalNumber,
  participantNames,
  isFinal,
  canToggleFinal,
  anchor,
  onToggleFinal,
  onClose,
}: {
  language: Language;
  result: ProposalResult;
  proposalNumber: number;
  participantNames: string[];
  isFinal: boolean;
  canToggleFinal: boolean;
  anchor: DOMRect;
  onToggleFinal: () => void;
  onClose: () => void;
}) {
  const t = useTexts(language);
  const approved = new Set(result.approvedBy.map((name) => name.toLocaleLowerCase()));
  const participants = [...new Set(participantNames)]
    .sort((a, b) => a.localeCompare(b, language))
    .map((name) => ({
      name,
      approved: approved.has(name.toLocaleLowerCase()),
    }));
  const position = overlayPosition(anchor);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="pointer-events-auto fixed rounded-lg border border-border bg-card p-3 shadow-xl" style={position}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase text-primary">Vorschlag #{proposalNumber}</div>
            <h3 className="mt-1 text-lg font-semibold">{t.proposalDetails}</h3>
          </div>
          <Button size="icon" variant="ghost" title={t.close} onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-3 rounded-md bg-muted p-3 text-sm">
          <div className="font-medium">
            {result.approvalCount}/{participants.length} ({Math.round(result.approvalRatio * 100)}%)
          </div>
          <div className="mt-2 h-2 rounded-full bg-white">
            <div className="h-2 rounded-full bg-amber-400" style={{ width: `${result.approvalRatio * 100}%` }} />
          </div>
        </div>

        <div className="mt-4 divide-y divide-border rounded-md border border-border">
          {participants.map((participant) => (
            <div key={participant.name} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="flex h-5 w-5 items-center justify-center">
                {participant.approved ? <Check className="h-4 w-4 text-primary" /> : null}
              </span>
              <span>{participant.name}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          {canToggleFinal && (
            <Button variant={isFinal ? "secondary" : "primary"} onClick={onToggleFinal}>
              {isFinal ? t.unmarkFinal : t.markFinal}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function FinalPicker({ language, view, meetingId, editId, onSaved }: { language: Language; view: OrganizerMeetingView; meetingId: string; editId: string; onSaved: () => void }) {
  const t = useTexts(language);
  const [selected, setSelected] = useState(view.meeting.data.finalProposalIds);
  const [copyZone, setCopyZone] = useState(view.meeting.data.editorTimeZone);

  async function save() {
    await api.setFinalProposals(meetingId, { editId, finalProposalIds: selected });
    onSaved();
  }

  function copyResult() {
    const final = view.meeting.data.proposals.filter((proposal) => selected.includes(proposal.id));
    const text = [
      view.meeting.data.title,
      `Time zone: ${copyZone}`,
      "",
      ...final.map((proposal) => `- ${formatDateTime(proposal.startsAtUtc, language, copyZone)} - ${formatDateTime(addMinutesIso(proposal.startsAtUtc, view.meeting.data.durationMinutes), language, copyZone)}`),
    ].join("\n");
    void navigator.clipboard.writeText(text);
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t.finalDates}</h2>
        <div className="flex flex-wrap gap-2">
          <div className="w-72">
            <TimeZonePicker value={copyZone} onChange={setCopyZone} language={language} />
          </div>
          <Button size="icon" className="h-8 w-8" title={t.copyResult} onClick={copyResult}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button variant="primary" onClick={save}>
            <Save className="h-4 w-4" />
            {t.save}
          </Button>
        </div>
      </div>
      <ProposalResultCards language={language} view={view} selected={selected} setSelected={setSelected} />
    </section>
  );
}

function ProposalResultCards({
  language,
  view,
  selected,
  setSelected,
}: {
  language: Language;
  view: OrganizerMeetingView;
  selected?: string[];
  setSelected?: (selected: string[]) => void;
}) {
  const t = useTexts(language);
  const zone = view.meeting.data.editorTimeZone;
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {view.proposalResults.map((proposal, index) => {
        const active = selected?.includes(proposal.id) ?? proposal.isFinal;
        const percentage = Math.round(proposal.approvalRatio * 100);
        const card = (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase text-primary">Vorschlag #{index + 1}</div>
                <div className="mt-1 font-medium">{formatDateTime(proposal.startsAtUtc, language, zone)}</div>
                <div className="text-sm text-muted-foreground">
                  {formatDateTime(addMinutesIso(proposal.startsAtUtc, view.meeting.data.durationMinutes), language, zone)}
                </div>
              </div>
              <div className="rounded-md bg-primary/10 px-3 py-2 text-right">
                <div className="text-lg font-semibold text-primary">
                  {proposal.approvalCount}/{view.knownParticipantCount}
                </div>
                <div className="text-xs text-muted-foreground">{t.approval}</div>
              </div>
            </div>
            <div className="mt-3 h-2 rounded-full bg-muted">
              <div className="h-2 rounded-full bg-primary" style={{ width: `${proposal.approvalRatio * 100}%` }} />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{percentage}%</div>
            <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
              <div>
                <span className="font-semibold text-foreground">{t.yes}:</span> {proposal.approvedBy.join(", ") || "-"}
              </div>
              <div>
                <span className="font-semibold text-foreground">{t.no}:</span> {proposal.declinedBy.join(", ") || "-"}
              </div>
            </div>
          </>
        );

        if (!selected || !setSelected) {
          return (
            <div key={proposal.id} className="rounded-lg border border-border bg-white p-3 text-left">
              {card}
            </div>
          );
        }

        const currentSelection = selected;
        const updateSelection = setSelected;

        return (
          <button
            key={proposal.id}
            type="button"
            className={cn("rounded-lg border border-border bg-white p-3 text-left transition hover:border-primary", active && "border-primary bg-primary/10")}
            onClick={() => updateSelection(active ? currentSelection.filter((id) => id !== proposal.id) : [...currentSelection, proposal.id])}
          >
            {card}
          </button>
        );
      })}
    </div>
  );
}

function ParticipantView({ language, meetingId }: { language: Language; meetingId: string }) {
  const t = useTexts(language);
  const participantKey = `letsmeet.participantId.${meetingId}`;
  const pinKey = `letsmeet.pinVerified.${meetingId}`;
  const [participantId] = useState(() => {
    const existing = localStorage.getItem(participantKey);
    if (existing) return existing;
    const next = crypto.randomUUID();
    localStorage.setItem(participantKey, next);
    return next;
  });
  const [pinVerified, setPinVerified] = useState(() => localStorage.getItem(pinKey) === "true");
  const [view, setView] = useState<ParticipantMeetingView | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      setView(await api.getParticipantMeeting(meetingId, participantId, pinVerified));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.meetingNotFound);
    }
  }

  useEffect(() => {
    void load();
  }, [meetingId, participantId, pinVerified]);

  if (error) return <StateMessage title={t.meetingNotFound} detail={error} />;
  if (!view) return <StateMessage title="LetsMeet" detail="Loading" />;
  if (view.pinRequired && !view.pinVerified) return <PinGate language={language} meetingId={meetingId} onVerified={() => {
    localStorage.setItem(pinKey, "true");
    setPinVerified(true);
  }} />;

  return <VoteForm language={language} view={view} participantId={participantId} reload={load} />;
}

function VoteForm({ language, view, participantId, reload }: { language: Language; view: ParticipantMeetingView; participantId: string; reload: () => void }) {
  const t = useTexts(language);
  const zone = getBrowserTimeZone();
  const closed = Boolean(view.closedAt);
  const [name, setName] = useState(view.participantVote?.data.participantName ?? "");
  const [selected, setSelected] = useState<string[]>(closed ? (view.participantVote?.data.selectedProposalIds ?? []) : []);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const finalIds = new Set(view.finalProposalIds);
  const canSubmit = name.trim().length > 0 && !busy;

  async function submit() {
    if (!canSubmit) return;

    setBusy(true);
    try {
      await api.submitVote(view.meetingId, { participantId, participantName: name, selectedProposalIds: selected });
      await reload();
      showToast(t.voteSaved);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed right-5 top-5 z-50 rounded-md border border-border bg-card px-4 py-3 text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}
      <section className="rounded-lg border border-border bg-card p-4">
        <h1 className="text-2xl font-semibold">{view.title}</h1>
        {view.description && <p className="mt-2 whitespace-pre-line text-muted-foreground">{view.description}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Globe2 className="h-4 w-4" />
          {t.localTimes}: {zone}
          {closed && <span className="rounded-full bg-accent px-2 py-1 text-accent-foreground">{t.votingClosed}</span>}
        </div>
      </section>

      {closed && view.finalProposalIds.length > 0 && (
        <section className="rounded-lg border border-primary bg-primary/10 p-4">
          <h2 className="mb-3 text-lg font-semibold">{t.finalDates}</h2>
          <div className="grid gap-2 md:grid-cols-2">
            {view.proposals.filter((proposal) => finalIds.has(proposal.id)).map((proposal) => (
              <div key={proposal.id} className="rounded-md bg-white p-3 font-medium">
                {formatDateTime(proposal.startsAtUtc, language, zone)}
              </div>
            ))}
          </div>
          <a className="mt-3 inline-flex" href={`/api/meetings/${view.meetingId}/final.ics`}>
            <Button size="sm" className="h-8 px-2" title={t.downloadIcs}>
              <Download className="h-3.5 w-3.5" />
              .ics
            </Button>
          </a>
        </section>
      )}

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-4 grid gap-3 md:grid-cols-[minmax(260px,360px)_auto_auto]">
          <Field label={`${t.name} *`}>
            <input className="w-full rounded-md border border-input px-3 py-2" value={name} disabled={closed} onChange={(e) => setName(e.target.value)} />
          </Field>
          {!closed && (
            <div className="flex items-end gap-2">
              <Button onClick={() => setSelected(view.proposals.map((proposal) => proposal.id))}>
                <Check className="h-4 w-4" />
                {t.all}
              </Button>
              <Button onClick={() => setSelected([])}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          {!closed && (
            <div className="flex items-end justify-end">
              <Button variant="primary" disabled={!canSubmit} onClick={submit}>
                <Save className="h-4 w-4" />
                {t.submitVote}
              </Button>
            </div>
          )}
        </div>
        <p className="mb-3 text-sm text-muted-foreground">{t.voteInstruction}</p>
        <ParticipantCalendar
          language={language}
          proposals={view.proposals}
          durationMinutes={view.durationMinutes}
          selected={selected}
          setSelected={setSelected}
          disabled={closed}
          finalProposalIds={view.finalProposalIds}
        />
      </section>
    </div>
  );
}

function ParticipantCalendar({
  language,
  proposals,
  durationMinutes,
  selected,
  setSelected,
  disabled,
  finalProposalIds,
}: {
  language: Language;
  proposals: Proposal[];
  durationMinutes: number;
  selected: string[];
  setSelected: (selected: string[]) => void;
  disabled: boolean;
  finalProposalIds: string[];
}) {
  const zone = getBrowserTimeZone();
  const days = participantCalendarDays(proposals, zone, language);
  const slots = participantTimeSlots(proposals, durationMinutes, zone);
  const finalIds = new Set(finalProposalIds);
  const proposalNumbers = new Map(
    [...proposals]
      .sort((a, b) => a.startsAtUtc.localeCompare(b.startsAtUtc))
      .map((proposal, index) => [proposal.id, index + 1]),
  );

  function toggle(proposalId: string) {
    if (disabled) return;
    setSelected(selected.includes(proposalId) ? selected.filter((id) => id !== proposalId) : [...selected, proposalId]);
  }

  return (
    <div className="overflow-auto">
      <div className="calendar-grid grid min-w-max gap-px" style={{ "--day-count": days.length } as CSSProperties}>
        <div className="sticky left-0 z-10 bg-card" />
        {days.map((day) => (
          <div
            key={day.date}
            className={cn(
              "border-l border-border bg-muted px-3 py-2 text-sm font-medium",
              day.isWeekend && "bg-accent/20",
              day.isMonday && "border-l-4 border-l-primary",
            )}
          >
            {day.label}
          </div>
        ))}
        {slots.map((time) => (
          <ParticipantCalendarRow
            key={time}
            time={time}
            days={days}
            proposals={proposals}
            durationMinutes={durationMinutes}
            selected={selected}
            disabled={disabled}
            finalIds={finalIds}
            proposalNumbers={proposalNumbers}
            zone={zone}
            onToggle={toggle}
          />
        ))}
      </div>
    </div>
  );
}

function ParticipantCalendarRow({
  time,
  days,
  proposals,
  durationMinutes,
  selected,
  disabled,
  finalIds,
  proposalNumbers,
  zone,
  onToggle,
}: {
  time: string;
  days: { date: string; label: string; isWeekend: boolean; isMonday: boolean }[];
  proposals: Proposal[];
  durationMinutes: number;
  selected: string[];
  disabled: boolean;
  finalIds: Set<string>;
  proposalNumbers: Map<string, number>;
  zone: string;
  onToggle: (proposalId: string) => void;
}) {
  return (
    <>
      <div className="sticky left-0 z-10 border-t border-border bg-card px-2 py-2 text-xs text-muted-foreground">{time}</div>
      {days.map((day) => {
        const startsAtUtc = zonedWallTimeToUtcIso(day.date, time, zone);
        const proposal = findCoveringProposal(proposals, startsAtUtc, durationMinutes);
        const isProposalStart = proposal?.startsAtUtc === startsAtUtc;
        const active = proposal ? selected.includes(proposal.id) : false;
        const isFinal = proposal ? finalIds.has(proposal.id) : false;
        return (
          <button
            key={`${day.date}-${time}`}
            type="button"
            disabled={!proposal || disabled}
            className={cn(
              "h-9 border-l border-t border-border px-1 text-xs transition disabled:cursor-default",
              day.isWeekend && "bg-accent/10",
              day.isMonday && "border-l-4 border-l-primary",
              proposal && "border-slate-400 bg-slate-300 text-slate-800 hover:bg-slate-400/70",
              active && "bg-primary/75 text-primary-foreground hover:bg-primary/85",
              active && isProposalStart && "bg-primary hover:bg-primary/90",
              disabled && proposal && !isFinal && "opacity-45",
              isFinal && "bg-primary/25 opacity-100",
              isFinal && active && "bg-primary text-primary-foreground",
            )}
            onClick={() => proposal && onToggle(proposal.id)}
          >
            {isProposalStart && proposal ? (
              <span className="flex items-center justify-center gap-1 truncate">
                {active ? <Check className="h-4 w-4 shrink-0" /> : null}
                <span className="truncate">Vorschlag #{proposalNumbers.get(proposal.id)}</span>
              </span>
            ) : null}
          </button>
        );
      })}
    </>
  );
}

function PinGate({ language, meetingId, onVerified }: { language: Language; meetingId: string; onVerified: () => void }) {
  const t = useTexts(language);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  async function verify() {
    setError("");
    try {
      await api.verifyPin(meetingId, normalizePin(pin));
      onVerified();
    } catch {
      setError(t.wrongPin);
    }
  }

  return (
    <section className="mx-auto max-w-sm rounded-lg border border-border bg-card p-5">
      <h1 className="mb-4 text-lg font-semibold">{t.enterPin}</h1>
      <input className="w-full rounded-md border border-input px-3 py-2" value={formatPin(pin)} onChange={(e) => setPin(normalizePin(e.target.value))} />
      <Button className="mt-3 w-full" variant="primary" onClick={verify}>
        <Lock className="h-4 w-4" />
        {t.verify}
      </Button>
      {error && <div className="mt-3 text-sm text-destructive">{error}</div>}
    </section>
  );
}

function CopyLine({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="truncate text-sm">{value}</div>
      </div>
      <Button
        size="icon"
        title={label}
        onClick={() => {
          void navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        }}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      {children}
    </label>
  );
}

function StateMessage({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-muted-foreground">{detail}</p>
    </div>
  );
}

const ADMIN_PIN_STORAGE = "letsmeet.adminPin";

function AdminView({ language }: { language: Language }) {
  const t = useTexts(language);
  const locale = language === "de" ? "de-DE" : "en-US";
  const timeZone = getBrowserTimeZone();
  const [pin, setPin] = useState<string>("");
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<AdminMeetingsView | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [gateError, setGateError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [toast, setToast] = useState("");
  const [newPin, setNewPin] = useState("");
  const [repeatPin, setRepeatPin] = useState("");
  const [pinFormError, setPinFormError] = useState("");

  async function loadWith(candidate: string): Promise<boolean> {
    try {
      const data = await api.adminListMeetings(candidate);
      setView(data);
      setPin(candidate);
      setAuthed(true);
      sessionStorage.setItem(ADMIN_PIN_STORAGE, candidate);
      return true;
    } catch {
      return false;
    }
  }

  useEffect(() => {
    const stored = sessionStorage.getItem(ADMIN_PIN_STORAGE);
    if (!stored) {
      setReady(true);
      return;
    }
    void loadWith(stored).then((ok) => {
      if (!ok) sessionStorage.removeItem(ADMIN_PIN_STORAGE);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!confirmingDelete) return;
    const handle = window.setTimeout(() => setConfirmingDelete(false), 3000);
    return () => window.clearTimeout(handle);
  }, [confirmingDelete]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  async function submitGate(event: FormEvent) {
    event.preventDefault();
    setGateError("");
    if (!(await loadWith(pinInput))) setGateError(t.adminWrongPin);
  }

  function toggleSelected(id: string) {
    setConfirmingDelete(false);
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setConfirmingDelete(false);
    const ids = view?.meetings.map((meeting) => meeting.id) ?? [];
    setSelected((prev) => (prev.size === ids.length ? new Set() : new Set(ids)));
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    try {
      await api.adminDeleteMeetings(pin, [...selected]);
      setConfirmingDelete(false);
      setSelected(new Set());
      await loadWith(pin);
      showToast(t.adminDeleted);
    } catch (error) {
      setConfirmingDelete(false);
      showToast(error instanceof Error ? error.message : "Error");
    }
  }

  async function submitPinChange(event: FormEvent) {
    event.preventDefault();
    setPinFormError("");
    if (!/^[0-9a-zA-Z]{6}$/.test(newPin)) {
      setPinFormError(t.adminPinFormat);
      return;
    }
    if (newPin !== repeatPin) {
      setPinFormError(t.adminPinMismatch);
      return;
    }
    try {
      await api.adminChangePin(pin, newPin);
      setPin(newPin);
      sessionStorage.setItem(ADMIN_PIN_STORAGE, newPin);
      setNewPin("");
      setRepeatPin("");
      showToast(t.adminPinChanged);
    } catch (error) {
      setPinFormError(error instanceof Error ? error.message : "Error");
    }
  }

  if (!ready) return <StateMessage title={t.adminTitle} detail="…" />;

  if (!authed) {
    return (
      <div className="mx-auto max-w-sm">
        <form onSubmit={submitGate} className="space-y-4 rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">{t.adminTitle}</h1>
          </div>
          <Field label={t.adminPinPrompt}>
            <input
              className="w-full rounded-md border border-input px-3 py-2 tracking-widest"
              value={pinInput}
              onChange={(event) => setPinInput(event.target.value)}
              maxLength={6}
              autoFocus
            />
          </Field>
          {gateError && <p className="text-sm text-destructive">{gateError}</p>}
          <Button type="submit" variant="primary" className="w-full">
            {t.verify}
          </Button>
        </form>
      </div>
    );
  }

  const meetings = view?.meetings ?? [];
  const allSelected = meetings.length > 0 && selected.size === meetings.length;

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed right-5 top-5 z-50 rounded-md border border-border bg-card px-4 py-3 text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t.adminTitle}</h1>
        <button
          type="button"
          onClick={deleteSelected}
          disabled={selected.size === 0}
          title={confirmingDelete ? t.adminConfirmDelete : t.adminDeleteSelected}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-ring disabled:pointer-events-none disabled:opacity-50",
            confirmingDelete
              ? "border-red-500 bg-red-500 text-white hover:bg-red-600"
              : "border-border text-muted-foreground hover:border-red-300 hover:bg-red-50 hover:text-red-600",
          )}
        >
          <Trash2 className="h-4 w-4" />
          {(confirmingDelete ? t.adminConfirmDelete : t.adminDeleteSelected) + (selected.size ? ` (${selected.size})` : "")}
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="w-10 px-3 py-3">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label={t.adminSelectAll} />
              </th>
              <th className="px-3 py-3">{t.adminColTitle}</th>
              <th className="px-3 py-3">{t.adminColCreated}</th>
              <th className="px-3 py-3 text-right">{t.adminColParticipants}</th>
              <th className="px-3 py-3">{t.adminColLastProposal}</th>
              <th className="px-3 py-3">{t.adminColStatus}</th>
            </tr>
          </thead>
          <tbody>
            {meetings.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  {t.adminNoMeetings}
                </td>
              </tr>
            )}
            {meetings.map((meeting) => (
              <tr key={meeting.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(meeting.id)}
                    onChange={() => toggleSelected(meeting.id)}
                    aria-label={meeting.title}
                  />
                </td>
                <td className="px-3 py-3 font-medium">{meeting.title}</td>
                <td className="px-3 py-3 text-muted-foreground">{formatDateTime(meeting.createdAt, locale, timeZone)}</td>
                <td className="px-3 py-3 text-right">{meeting.participantCount}</td>
                <td className="px-3 py-3 text-muted-foreground">
                  {meeting.lastProposalStartUtc ? formatDateTime(meeting.lastProposalStartUtc, locale, timeZone) : "—"}
                </td>
                <td className="px-3 py-3">
                  {meeting.expired ? (
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                      {t.adminExpired}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                      {t.adminActive}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={submitPinChange} className="max-w-md space-y-3 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Lock className="h-4 w-4 text-primary" />
          {t.adminChangePin}
        </div>
        <Field label={t.adminNewPin}>
          <input
            className="w-full rounded-md border border-input px-3 py-2 tracking-widest"
            value={newPin}
            onChange={(event) => setNewPin(event.target.value)}
            maxLength={6}
          />
        </Field>
        <Field label={t.adminRepeatPin}>
          <input
            className="w-full rounded-md border border-input px-3 py-2 tracking-widest"
            value={repeatPin}
            onChange={(event) => setRepeatPin(event.target.value)}
            maxLength={6}
          />
        </Field>
        {pinFormError && <p className="text-sm text-destructive">{pinFormError}</p>}
        <Button type="submit" variant="primary">
          {t.adminChangePin}
        </Button>
      </form>
    </div>
  );
}

function calendarDays(maxDate: string, includeWeekends: boolean, language: Language) {
  const locale = language === "de" ? "de-DE" : "en-US";
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(`${maxDate}T00:00:00`);
  const dayCount = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1);

  return Array.from({ length: dayCount }, (_, index) => addDays(start, index))
    .filter((date) => includeWeekends || (date.getDay() !== 0 && date.getDay() !== 6))
    .map((date) => ({
      date: format(date, "yyyy-MM-dd"),
      label: new Intl.DateTimeFormat(locale, { weekday: "short", day: "2-digit", month: "2-digit" }).format(date),
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      isMonday: date.getDay() === 1,
    }));
}

function participantCalendarDays(proposals: Proposal[], timeZone: string, language: Language) {
  const locale = language === "de" ? "de-DE" : "en-US";
  if (proposals.length === 0) return calendarDays(format(new Date(), "yyyy-MM-dd"), true, language);

  const proposalDates = proposals.map((proposal) => utcIsoToZonedParts(proposal.startsAtUtc, timeZone).date).sort();
  const proposalDateSet = new Set(proposalDates);
  const start = localDateFromIsoDate(proposalDates[0]);
  const end = localDateFromIsoDate(proposalDates[proposalDates.length - 1]);
  const dayCount = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1);

  return Array.from({ length: dayCount }, (_, index) => addDays(start, index))
    .filter((date) => {
      const isoDate = format(date, "yyyy-MM-dd");
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      return !isWeekend || proposalDateSet.has(isoDate);
    })
    .map((date) => ({
      date: format(date, "yyyy-MM-dd"),
      label: new Intl.DateTimeFormat(locale, { weekday: "short", day: "2-digit", month: "2-digit" }).format(date),
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      isMonday: date.getDay() === 1,
    }));
}

function participantTimeSlots(proposals: Proposal[], durationMinutes: number, timeZone: string): string[] {
  if (proposals.length === 0) return timeSlots("09:00", "10:00");

  const intervals = proposals.map((proposal) => {
    const start = utcIsoToZonedParts(proposal.startsAtUtc, timeZone).time;
    const end = utcIsoToZonedParts(addMinutesIso(proposal.startsAtUtc, durationMinutes), timeZone).time;
    return {
      start: minutesFromTime(start),
      end: minutesFromTime(end),
    };
  });
  const startMinutes = Math.max(0, Math.floor(Math.min(...intervals.map((interval) => interval.start)) / 15) * 15);
  const endMinutes = Math.min(24 * 60, Math.ceil(Math.max(...intervals.map((interval) => interval.end)) / 15) * 15);

  return timeSlots(timeFromMinutes(startMinutes), timeFromMinutes(Math.max(endMinutes, startMinutes + 15)));
}

function timeSlots(dayStart: string, dayEnd: string): string[] {
  const [startH, startM] = dayStart.split(":").map(Number);
  const [endH, endM] = dayEnd.split(":").map(Number);
  const start = startH * 60 + startM;
  const end = endH * 60 + endM;
  const slots: string[] = [];
  for (let minutes = start; minutes < end; minutes += 15) {
    const h = String(Math.floor(minutes / 60)).padStart(2, "0");
    const m = String(minutes % 60).padStart(2, "0");
    slots.push(`${h}:${m}`);
  }
  return slots;
}

function findCoveringProposal(proposals: Proposal[], slotStartsAtUtc: string, durationMinutes: number): Proposal | undefined {
  const slotStart = Date.parse(slotStartsAtUtc);
  return proposals.find((proposal) => {
    const proposalStart = Date.parse(proposal.startsAtUtc);
    const proposalEnd = proposalStart + durationMinutes * 60_000;
    return slotStart >= proposalStart && slotStart < proposalEnd;
  });
}

function hasOverlappingProposal(proposals: Proposal[], startsAtUtc: string, durationMinutes: number): boolean {
  const start = Date.parse(startsAtUtc);
  const end = start + durationMinutes * 60_000;
  return proposals.some((proposal) => {
    const proposalStart = Date.parse(proposal.startsAtUtc);
    const proposalEnd = proposalStart + durationMinutes * 60_000;
    return proposalStart < end && start < proposalEnd;
  });
}

function feedbackCellStyle(approvalRatio: number, isFinal: boolean): CSSProperties {
  if (isFinal) {
    return {
      backgroundColor: "rgba(250, 204, 21, 0.35)",
      color: "rgb(30, 41, 59)",
    };
  }

  if (approvalRatio === 0) {
    return {
      backgroundColor: "rgb(203, 213, 225)",
      color: "rgb(30, 41, 59)",
    };
  }

  const opacity = 0.28 + approvalRatio * 0.62;
  return {
    backgroundColor: `rgba(20, 120, 104, ${opacity})`,
    color: approvalRatio > 0.55 ? "white" : "rgb(20, 83, 73)",
  };
}

function proposalNumberFor(proposals: Proposal[], proposalId: string): number {
  const index = [...proposals].sort((a, b) => a.startsAtUtc.localeCompare(b.startsAtUtc)).findIndex((proposal) => proposal.id === proposalId);
  return index + 1;
}

function overlayPosition(anchor: DOMRect): CSSProperties {
  const margin = 12;
  const offset = 14;
  const width = Math.min(Math.max(anchor.width, 220), 320, window.innerWidth - margin * 2);
  const left = Math.min(Math.max(margin, anchor.left + offset), window.innerWidth - margin - width);
  const top = Math.max(margin, anchor.bottom + 8);

  return {
    left,
    maxHeight: `calc(100vh - ${top + margin}px)`,
    overflowY: "auto",
    top,
    width,
  };
}

function slotFitsDuration(time: string, durationMinutes: number, dayEnd: string): boolean {
  return minutesFromTime(time) + durationMinutes <= minutesFromTime(dayEnd);
}

function minutesFromTime(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function timeFromMinutes(minutes: number): string {
  const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
  const rest = String(minutes % 60).padStart(2, "0");
  return `${hours}:${rest}`;
}

function localDateFromIsoDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function durationOptions(): number[] {
  return Array.from({ length: 32 }, (_, index) => (index + 1) * 15);
}

function formatDuration(minutes: number, language: Language): string {
  if (minutes < 60) return language === "de" ? `${minutes} Minuten` : `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourLabel = language === "de" ? `${hours} Std.` : `${hours} h`;
  return rest === 0 ? hourLabel : `${hourLabel} ${rest} min`;
}

function TimeZonePicker({
  value,
  onChange,
  language,
}: {
  value: string;
  onChange: (timeZone: string) => void;
  language: Language;
}) {
  const storageKey = "letsmeet.favoriteTimeZones";
  const allZones = useMemo(() => getSupportedTimeZones(), []);
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? "[]") as string[];
    } catch {
      return [];
    }
  });

  useEffect(() => setQuery(value), [value]);

  function persistFavorites(next: string[]) {
    setFavorites(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  }

  function choose(zone: string) {
    onChange(zone);
    setQuery(zone);
    setOpen(false);
    const next = [zone, ...favorites.filter((favorite) => favorite !== zone)].slice(0, 6);
    persistFavorites(next);
  }

  function removeFavorite(zone: string) {
    persistFavorites(favorites.filter((favorite) => favorite !== zone));
  }

  const normalizedQuery = query.toLowerCase();
  const orderedZones = [...favorites.filter((zone) => allZones.includes(zone)), ...allZones.filter((zone) => !favorites.includes(zone))];
  const matches = orderedZones.filter((zone) => zone.toLowerCase().includes(normalizedQuery)).slice(0, 12);
  const favoriteLabel = language === "de" ? "Favoriten" : "Favorites";

  return (
    <div className="relative">
      <input
        className="w-full rounded-md border border-input px-3 py-2"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      />
      {favorites.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          <span className="mr-1 self-center text-xs text-muted-foreground">{favoriteLabel}</span>
          {favorites.map((zone) => (
            <span key={zone} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs">
              <button type="button" className="max-w-32 truncate" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(zone)}>
                {zone}
              </button>
              <button
                type="button"
                title={language === "de" ? "Favorit entfernen" : "Remove favorite"}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => removeFavorite(zone)}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {open && (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-white p-1 shadow-lg">
          {matches.map((zone) => (
            <button
              key={zone}
              type="button"
              className={cn("block w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-muted", zone === value && "bg-primary/10 font-medium")}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(zone)}
            >
              {zone}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
