import type { AdminMeetingSummary, AdminMeetingsView, MeetingRecord } from "../../shared/domain";
import { listMeetingsWithVoteCounts } from "../db";

function lastProposalStart(meeting: MeetingRecord): string | null {
  const starts = meeting.data.proposals.map((proposal) => proposal.startsAtUtc).sort();
  return starts.length ? starts[starts.length - 1] : null;
}

export async function process(): Promise<AdminMeetingsView> {
  const now = Date.now();
  const rows = await listMeetingsWithVoteCounts();
  const meetings: AdminMeetingSummary[] = rows.map(({ meeting, participantCount }) => {
    const lastStart = lastProposalStart(meeting);
    return {
      id: meeting.id,
      title: meeting.data.title,
      createdAt: meeting.createdAt,
      participantCount,
      lastProposalStartUtc: lastStart,
      durationMinutes: meeting.data.durationMinutes,
      expired: lastStart !== null && new Date(lastStart).getTime() < now,
    };
  });
  return { meetings };
}
