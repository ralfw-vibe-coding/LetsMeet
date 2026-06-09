import type { MeetingRecord } from "../shared/domain";
import { addMinutesIso } from "../shared/time";

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function icsDate(iso: string): string {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function buildFinalIcs(meeting: MeetingRecord): string | null {
  if (!meeting.closedAt || meeting.data.finalProposalIds.length === 0) return null;

  const finalIds = new Set(meeting.data.finalProposalIds);
  const finalProposals = meeting.data.proposals.filter((proposal) => finalIds.has(proposal.id));
  if (finalProposals.length === 0) return null;

  const now = icsDate(new Date().toISOString());
  const events = finalProposals.map((proposal) => {
    const end = addMinutesIso(proposal.startsAtUtc, meeting.data.durationMinutes);
    return [
      "BEGIN:VEVENT",
      `UID:${proposal.id}@letsmeet`,
      `DTSTAMP:${now}`,
      `DTSTART:${icsDate(proposal.startsAtUtc)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${escapeText(meeting.data.title)}`,
      meeting.data.description ? `DESCRIPTION:${escapeText(meeting.data.description)}` : null,
      "END:VEVENT",
    ]
      .filter(Boolean)
      .join("\r\n");
  });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LetsMeet//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events,
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
