import { adminDeleteMeetingsRequestSchema } from "../../shared/domain";
import { deleteMeetings } from "../db";

export async function process(request: unknown) {
  const parsed = adminDeleteMeetingsRequestSchema.parse(request);
  const deleted = await deleteMeetings(parsed.meetingIds);
  return { deleted };
}
