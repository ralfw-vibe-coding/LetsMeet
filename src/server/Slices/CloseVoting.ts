import { closeVotingRequestSchema } from "../../shared/domain";
import { closeMeeting, findMeetingForEdit } from "../db";
import { notFound } from "../errors";

export async function process(meetingId: string, request: unknown) {
  const parsed = closeVotingRequestSchema.parse(request);
  const meeting = await findMeetingForEdit(meetingId, parsed.editId);
  if (!meeting) throw notFound();
  return closeMeeting(meetingId);
}
