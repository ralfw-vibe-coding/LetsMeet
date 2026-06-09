import { findMeeting, findVote } from "../db";
import { notFound } from "../errors";

export async function process(meetingId: string, participantId: string | null, pinVerified: boolean) {
  const meeting = await findMeeting(meetingId);
  if (!meeting) throw notFound();

  const participantVote = participantId ? await findVote(meetingId, participantId) : null;
  const pinRequired = Boolean(meeting.data.participantPin);

  return {
    role: "participant" as const,
    meetingId,
    title: meeting.data.title,
    description: meeting.data.description,
    durationMinutes: meeting.data.durationMinutes,
    proposals: meeting.data.proposals,
    finalProposalIds: meeting.data.finalProposalIds,
    closedAt: meeting.closedAt,
    participantVote,
    pinRequired,
    pinVerified: !pinRequired || pinVerified,
  };
}
