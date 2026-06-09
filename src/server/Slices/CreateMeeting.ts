import type { CreateMeetingRequest } from "../../shared/domain";
import { insertMeeting } from "../db";
import { validateMeetingData } from "../validation";

export async function process(request: CreateMeetingRequest) {
  const id = crypto.randomUUID();
  const editId = crypto.randomUUID();
  const data = validateMeetingData({ ...request, finalProposalIds: [] });
  return insertMeeting(id, editId, data);
}
