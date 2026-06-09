import { buildProposalResults } from "../../shared/viewModel";
import { findMeetingForEdit, listVotes } from "../db";
import { notFound } from "../errors";

export async function process(meetingId: string, editId: string) {
  const meeting = await findMeetingForEdit(meetingId, editId);
  if (!meeting) throw notFound();

  const votes = await listVotes(meetingId);
  return {
    role: "organizer" as const,
    meeting,
    votes,
    knownParticipantCount: votes.length,
    proposalResults: buildProposalResults(meeting, votes),
  };
}
