import type {
  AdminMeetingsView,
  CreateMeetingRequest,
  MeetingRecord,
  OrganizerMeetingView,
  ParticipantMeetingView,
  SetFinalProposalsRequest,
  SubmitVoteRequest,
  UpdateMeetingRequest,
} from "../shared/domain";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...options.headers,
    },
  });

  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(typeof body === "string" ? body : body.error?.message ?? "Request failed");
  }
  return body as T;
}

export const api = {
  createMeeting: (body: CreateMeetingRequest) =>
    request<MeetingRecord>("/meetings", { method: "POST", body: JSON.stringify(body) }),
  updateMeeting: (meetingId: string, body: UpdateMeetingRequest) =>
    request<MeetingRecord>(`/meetings/${meetingId}`, { method: "PUT", body: JSON.stringify(body) }),
  getOrganizerMeeting: (meetingId: string, editId: string) =>
    request<OrganizerMeetingView>(`/meetings/${meetingId}/edit/${editId}`),
  getParticipantMeeting: (meetingId: string, participantId: string | null, pinVerified: boolean) => {
    const params = new URLSearchParams();
    if (participantId) params.set("participantId", participantId);
    if (pinVerified) params.set("pinVerified", "true");
    return request<ParticipantMeetingView>(`/meetings/${meetingId}?${params.toString()}`);
  },
  verifyPin: (meetingId: string, pin: string) =>
    request<{ verified: boolean }>(`/meetings/${meetingId}/pin`, { method: "POST", body: JSON.stringify({ pin }) }),
  submitVote: (meetingId: string, body: SubmitVoteRequest) =>
    request(`/meetings/${meetingId}/votes`, { method: "POST", body: JSON.stringify(body) }),
  closeVoting: (meetingId: string, editId: string) =>
    request<MeetingRecord>(`/meetings/${meetingId}/close`, { method: "POST", body: JSON.stringify({ editId }) }),
  deleteMeeting: (meetingId: string, editId: string) =>
    request<{ deleted: boolean }>(`/meetings/${meetingId}`, { method: "DELETE", body: JSON.stringify({ editId }) }),
  setFinalProposals: (meetingId: string, body: SetFinalProposalsRequest) =>
    request<MeetingRecord>(`/meetings/${meetingId}/final-proposals`, { method: "PUT", body: JSON.stringify(body) }),
  adminVerifyPin: (pin: string) =>
    request<{ verified: boolean }>("/admin/verify", { method: "POST", body: JSON.stringify({ pin }) }),
  adminListMeetings: (pin: string) =>
    request<AdminMeetingsView>("/admin/meetings", { headers: { "x-admin-pin": pin } }),
  adminDeleteMeetings: (pin: string, meetingIds: string[]) =>
    request<{ deleted: number }>("/admin/delete", {
      method: "POST",
      headers: { "x-admin-pin": pin },
      body: JSON.stringify({ meetingIds }),
    }),
  adminChangePin: (pin: string, newPin: string) =>
    request<{ changed: boolean }>("/admin/pin", {
      method: "POST",
      headers: { "x-admin-pin": pin },
      body: JSON.stringify({ newPin }),
    }),
};
