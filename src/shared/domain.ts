import { z } from "zod";

export const languageSchema = z.enum(["de", "en"]);
export type Language = z.infer<typeof languageSchema>;

export const proposalSchema = z.object({
  id: z.string().uuid(),
  startsAtUtc: z.string().datetime(),
});
export type Proposal = z.infer<typeof proposalSchema>;

export const organizerCalendarSchema = z.object({
  maxDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dayStart: z.string().regex(/^\d{2}:\d{2}$/),
  dayEnd: z.string().regex(/^\d{2}:\d{2}$/),
  includeWeekends: z.boolean(),
});
export type OrganizerCalendar = z.infer<typeof organizerCalendarSchema>;

export const meetingDataSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().default(""),
  durationMinutes: z.number().int().min(15).max(480),
  participantPin: z.string().regex(/^\d{6}$/).optional(),
  editorTimeZone: z.string().min(1),
  organizerCalendar: organizerCalendarSchema,
  proposals: z.array(proposalSchema).min(1),
  finalProposalIds: z.array(z.string().uuid()).default([]),
});
export type MeetingData = z.infer<typeof meetingDataSchema>;

export const voteDataSchema = z.object({
  participantName: z.string().trim().min(1).max(40),
  selectedProposalIds: z.array(z.string().uuid()),
  submittedAt: z.string().datetime(),
});
export type VoteData = z.infer<typeof voteDataSchema>;

export type MeetingRecord = {
  id: string;
  editId: string;
  data: MeetingData;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
};

export type VoteRecord = {
  id: string;
  meetingId: string;
  participantId: string;
  data: VoteData;
  createdAt: string;
  updatedAt: string;
};

export type ProposalResult = Proposal & {
  approvalCount: number;
  approvalRatio: number;
  approvedBy: string[];
  declinedBy: string[];
  isFinal: boolean;
};

export type OrganizerMeetingView = {
  role: "organizer";
  meeting: MeetingRecord;
  votes: VoteRecord[];
  knownParticipantCount: number;
  proposalResults: ProposalResult[];
};

export type ParticipantMeetingView = {
  role: "participant";
  meetingId: string;
  title: string;
  description: string;
  durationMinutes: number;
  proposals: Proposal[];
  finalProposalIds: string[];
  closedAt: string | null;
  participantVote: VoteRecord | null;
  pinRequired: boolean;
  pinVerified: boolean;
};

export const createMeetingRequestSchema = meetingDataSchema.omit({ finalProposalIds: true }).extend({
  participantPin: z.string().regex(/^\d{6}$/).optional(),
});
export type CreateMeetingRequest = z.infer<typeof createMeetingRequestSchema>;

export const updateMeetingRequestSchema = createMeetingRequestSchema.extend({
  editId: z.string().uuid(),
});
export type UpdateMeetingRequest = z.infer<typeof updateMeetingRequestSchema>;

export const submitVoteRequestSchema = z.object({
  participantId: z.string().uuid(),
  participantName: z.string().trim().min(1).max(40),
  selectedProposalIds: z.array(z.string().uuid()),
});
export type SubmitVoteRequest = z.infer<typeof submitVoteRequestSchema>;

export const verifyParticipantPinRequestSchema = z.object({
  pin: z.string().regex(/^\d{6}$/),
});
export type VerifyParticipantPinRequest = z.infer<typeof verifyParticipantPinRequestSchema>;

export const setFinalProposalsRequestSchema = z.object({
  editId: z.string().uuid(),
  finalProposalIds: z.array(z.string().uuid()),
});
export type SetFinalProposalsRequest = z.infer<typeof setFinalProposalsRequestSchema>;

export const closeVotingRequestSchema = z.object({
  editId: z.string().uuid(),
});
export type CloseVotingRequest = z.infer<typeof closeVotingRequestSchema>;

export const deleteMeetingRequestSchema = z.object({
  editId: z.string().uuid(),
});
export type DeleteMeetingRequest = z.infer<typeof deleteMeetingRequestSchema>;

export const adminPinSchema = z.string().regex(/^[0-9a-zA-Z]{6}$/);

export const appSettingsSchema = z.object({
  adminPinHash: z.string().optional(),
});
export type AppSettings = z.infer<typeof appSettingsSchema>;

export const adminChangePinRequestSchema = z.object({
  newPin: adminPinSchema,
});
export type AdminChangePinRequest = z.infer<typeof adminChangePinRequestSchema>;

export const adminDeleteMeetingsRequestSchema = z.object({
  meetingIds: z.array(z.string().uuid()).min(1),
});
export type AdminDeleteMeetingsRequest = z.infer<typeof adminDeleteMeetingsRequestSchema>;

export type AdminMeetingSummary = {
  id: string;
  title: string;
  createdAt: string;
  participantCount: number;
  lastProposalStartUtc: string | null;
  durationMinutes: number;
  expired: boolean;
};

export type AdminMeetingsView = {
  meetings: AdminMeetingSummary[];
};

export type ApiError = {
  error: {
    code: string;
    message: string;
  };
};

export function normalizePin(value: string): string {
  return value.replace(/\s/g, "");
}

export function formatPin(value: string): string {
  const normalized = normalizePin(value);
  if (normalized.length <= 3) return normalized;
  return `${normalized.slice(0, 3)} ${normalized.slice(3, 6)}`;
}

export function isDurationValid(durationMinutes: number): boolean {
  return durationMinutes >= 15 && durationMinutes <= 480 && durationMinutes % 15 === 0;
}

export function minutesOfDay(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function isQuarterHourTime(time: string): boolean {
  return minutesOfDay(time) % 15 === 0;
}

export function isUtcQuarterHour(iso: string): boolean {
  const date = new Date(iso);
  return date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0 && date.getUTCMinutes() % 15 === 0;
}
