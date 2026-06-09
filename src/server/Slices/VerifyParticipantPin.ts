import { normalizePin, verifyParticipantPinRequestSchema } from "../../shared/domain";
import { findMeeting } from "../db";
import { forbidden, notFound } from "../errors";

export async function process(meetingId: string, request: unknown) {
  const parsed = verifyParticipantPinRequestSchema.parse({ pin: normalizePin(String((request as { pin?: unknown }).pin ?? "")) });
  const meeting = await findMeeting(meetingId);
  if (!meeting) throw notFound();
  if (!meeting.data.participantPin) return { verified: true };
  if (meeting.data.participantPin !== parsed.pin) throw forbidden("Wrong PIN.");
  return { verified: true };
}
