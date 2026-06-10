import { deleteMeetingRequestSchema } from "../../shared/domain";
import { deleteMeeting, findMeetingForEdit } from "../db";
import { notFound } from "../errors";

export async function process(meetingId: string, request: unknown) {
  const parsed = deleteMeetingRequestSchema.parse(request);
  const meeting = await findMeetingForEdit(meetingId, parsed.editId);
  if (!meeting) throw notFound();
  await deleteMeeting(meetingId);
  return { deleted: true };
}
