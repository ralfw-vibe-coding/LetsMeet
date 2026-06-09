import { isDurationValid, isQuarterHourTime, isUtcQuarterHour, meetingDataSchema, minutesOfDay, type MeetingData, type VoteRecord } from "../shared/domain";
import { utcIsoToZonedParts } from "../shared/time";
import { validation } from "./errors";

export function validateMeetingData(input: unknown): MeetingData {
  const data = meetingDataSchema.parse(input);

  if (!isDurationValid(data.durationMinutes)) {
    throw validation("Duration must be between 15 and 480 minutes in 15 minute steps.");
  }

  if (!isQuarterHourTime(data.organizerCalendar.dayStart) || !isQuarterHourTime(data.organizerCalendar.dayEnd)) {
    throw validation("Calendar day range must use 15 minute steps.");
  }

  if (minutesOfDay(data.organizerCalendar.dayEnd) <= minutesOfDay(data.organizerCalendar.dayStart)) {
    throw validation("Calendar day end must be after day start.");
  }

  const proposalIds = new Set<string>();
  for (const proposal of data.proposals) {
    if (proposalIds.has(proposal.id)) {
      throw validation("Proposal IDs must be unique.");
    }
    proposalIds.add(proposal.id);

    if (!isUtcQuarterHour(proposal.startsAtUtc)) {
      throw validation("Proposal start times must be on the 15 minute grid.");
    }

    assertProposalInsideOrganizerRange(data, proposal.startsAtUtc);
  }

  assertProposalsDoNotOverlap(data);

  for (const finalProposalId of data.finalProposalIds) {
    if (!proposalIds.has(finalProposalId)) {
      throw validation("Final proposals must exist.");
    }
  }

  return data;
}

export function assertKnownProposalIds(data: MeetingData, selectedProposalIds: string[]): void {
  const proposalIds = new Set(data.proposals.map((proposal) => proposal.id));
  for (const selectedProposalId of selectedProposalIds) {
    if (!proposalIds.has(selectedProposalId)) {
      throw validation("Vote references an unknown proposal.");
    }
  }
}

export function assertUniqueParticipantName(votes: VoteRecord[], participantId: string, participantName: string): void {
  const normalized = participantName.trim().toLocaleLowerCase();
  const conflict = votes.find(
    (vote) => vote.participantId !== participantId && vote.data.participantName.trim().toLocaleLowerCase() === normalized,
  );
  if (conflict) {
    throw validation("Participant name is already used in this meeting.");
  }
}

export function removedProposalIds(previous: MeetingData, next: MeetingData): string[] {
  const nextIds = new Set(next.proposals.map((proposal) => proposal.id));
  return previous.proposals.map((proposal) => proposal.id).filter((proposalId) => !nextIds.has(proposalId));
}

function assertProposalInsideOrganizerRange(data: MeetingData, startsAtUtc: string): void {
  const parts = utcIsoToZonedParts(startsAtUtc, data.editorTimeZone);
  const startMinutes = minutesOfDay(parts.time);
  const dayStart = minutesOfDay(data.organizerCalendar.dayStart);
  const dayEnd = minutesOfDay(data.organizerCalendar.dayEnd);

  if (parts.date > data.organizerCalendar.maxDate) {
    throw validation("Proposal is outside the organizer date range.");
  }

  if (startMinutes < dayStart || startMinutes + data.durationMinutes > dayEnd) {
    throw validation("Proposal is outside the organizer day range.");
  }

  if (!data.organizerCalendar.includeWeekends) {
    const weekday = new Intl.DateTimeFormat("en", { timeZone: data.editorTimeZone, weekday: "short" }).format(new Date(startsAtUtc));
    if (weekday === "Sat" || weekday === "Sun") {
      throw validation("Proposal is outside the organizer weekday range.");
    }
  }
}

function assertProposalsDoNotOverlap(data: MeetingData): void {
  const intervals = data.proposals
    .map((proposal) => {
      const start = Date.parse(proposal.startsAtUtc);
      return {
        id: proposal.id,
        start,
        end: start + data.durationMinutes * 60_000,
      };
    })
    .sort((a, b) => a.start - b.start);

  for (let index = 1; index < intervals.length; index += 1) {
    const previous = intervals[index - 1];
    const current = intervals[index];
    if (current.start < previous.end) {
      throw validation("Proposals must not overlap.");
    }
  }
}
