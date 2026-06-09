import type { MeetingRecord, ProposalResult, VoteRecord } from "./domain";

export function buildProposalResults(meeting: MeetingRecord, votes: VoteRecord[]): ProposalResult[] {
  const knownParticipantCount = votes.length;
  const finalIds = new Set(meeting.data.finalProposalIds);

  return meeting.data.proposals
    .map((proposal) => {
      const approvedBy: string[] = [];
      const declinedBy: string[] = [];

      for (const vote of votes) {
        if (vote.data.selectedProposalIds.includes(proposal.id)) {
          approvedBy.push(vote.data.participantName);
        } else {
          declinedBy.push(vote.data.participantName);
        }
      }

      return {
        ...proposal,
        approvalCount: approvedBy.length,
        approvalRatio: knownParticipantCount === 0 ? 0 : approvedBy.length / knownParticipantCount,
        approvedBy,
        declinedBy,
        isFinal: finalIds.has(proposal.id),
      };
    })
    .sort((a, b) => b.approvalCount - a.approvalCount || a.startsAtUtc.localeCompare(b.startsAtUtc));
}
