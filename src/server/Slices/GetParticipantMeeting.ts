import { findMeeting, findVote, listVotes } from "../db";
import { notFound } from "../errors";

export async function process(meetingId: string, participantId: string | null, pinVerified: boolean) {
  const meeting = await findMeeting(meetingId);
  if (!meeting) throw notFound();

  const participantVote = participantId ? await findVote(meetingId, participantId) : null;
  const pinRequired = Boolean(meeting.data.participantPin);
  const votes = await listVotes(meetingId);
  const knownParticipantCount = votes.length;
  const proposalApprovals = meeting.data.proposals.map((proposal) => {
    const approvalCount = votes.filter((vote) => vote.data.selectedProposalIds.includes(proposal.id)).length;
    return {
      id: proposal.id,
      approvalCount,
      approvalRatio: knownParticipantCount === 0 ? 0 : approvalCount / knownParticipantCount,
    };
  });

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
    knownParticipantCount,
    proposalApprovals,
  };
}
