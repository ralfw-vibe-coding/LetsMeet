import { setFinalProposalsRequestSchema } from "../../shared/domain";
import { findMeetingForEdit, updateMeetingData } from "../db";
import { forbidden, notFound, validation } from "../errors";

export async function process(meetingId: string, request: unknown) {
  const parsed = setFinalProposalsRequestSchema.parse(request);
  const meeting = await findMeetingForEdit(meetingId, parsed.editId);
  if (!meeting) throw notFound();
  if (!meeting.closedAt) throw forbidden("Final proposals can only be set after voting is closed.");

  const existingIds = new Set(meeting.data.proposals.map((proposal) => proposal.id));
  for (const proposalId of parsed.finalProposalIds) {
    if (!existingIds.has(proposalId)) {
      throw validation("Final proposals must exist.");
    }
  }

  return updateMeetingData(meetingId, { ...meeting.data, finalProposalIds: parsed.finalProposalIds }, []);
}
