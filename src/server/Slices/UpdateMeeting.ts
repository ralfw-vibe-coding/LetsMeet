import type { UpdateMeetingRequest } from "../../shared/domain";
import { findMeetingForEdit, updateMeetingData } from "../db";
import { forbidden, notFound } from "../errors";
import { removedProposalIds, validateMeetingData } from "../validation";

export async function process(meetingId: string, request: UpdateMeetingRequest) {
  const meeting = await findMeetingForEdit(meetingId, request.editId);
  if (!meeting) throw notFound();
  if (meeting.closedAt) throw forbidden("Closed meetings can no longer be changed.");

  const data = validateMeetingData({ ...request, finalProposalIds: meeting.data.finalProposalIds });
  const removed = removedProposalIds(meeting.data, data);
  return updateMeetingData(meetingId, data, removed);
}
