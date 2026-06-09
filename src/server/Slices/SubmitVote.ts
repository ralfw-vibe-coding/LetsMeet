import { submitVoteRequestSchema, type VoteData } from "../../shared/domain";
import { findMeeting, listVotes, upsertVote } from "../db";
import { forbidden, notFound } from "../errors";
import { assertKnownProposalIds, assertUniqueParticipantName } from "../validation";

export async function process(meetingId: string, request: unknown) {
  const parsed = submitVoteRequestSchema.parse(request);
  const meeting = await findMeeting(meetingId);
  if (!meeting) throw notFound();
  if (meeting.closedAt) throw forbidden("Voting is closed.");

  assertKnownProposalIds(meeting.data, parsed.selectedProposalIds);

  const votes = await listVotes(meetingId);
  assertUniqueParticipantName(votes, parsed.participantId, parsed.participantName);

  const data: VoteData = {
    participantName: parsed.participantName.trim(),
    selectedProposalIds: parsed.selectedProposalIds,
    submittedAt: new Date().toISOString(),
  };

  return upsertVote(meetingId, parsed.participantId, data);
}
