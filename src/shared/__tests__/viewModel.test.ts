import { describe, expect, it } from "vitest";
import type { MeetingRecord, VoteRecord } from "../domain";
import { buildProposalResults } from "../viewModel";

const meeting: MeetingRecord = {
  id: "00000000-0000-4000-8000-000000000001",
  editId: "00000000-0000-4000-8000-000000000002",
  createdAt: "2026-06-09T00:00:00.000Z",
  updatedAt: "2026-06-09T00:00:00.000Z",
  closedAt: null,
  data: {
    title: "Training",
    description: "",
    durationMinutes: 60,
    editorTimeZone: "Europe/Berlin",
    organizerCalendar: {
      maxDate: "2026-06-30",
      dayStart: "09:00",
      dayEnd: "17:00",
      includeWeekends: false,
    },
    proposals: [
      { id: "00000000-0000-4000-8000-000000000011", startsAtUtc: "2026-06-10T09:00:00.000Z" },
      { id: "00000000-0000-4000-8000-000000000012", startsAtUtc: "2026-06-10T10:00:00.000Z" },
    ],
    finalProposalIds: ["00000000-0000-4000-8000-000000000012"],
  },
};

const votes: VoteRecord[] = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    meetingId: meeting.id,
    participantId: "00000000-0000-4000-8000-000000000201",
    createdAt: "2026-06-09T00:00:00.000Z",
    updatedAt: "2026-06-09T00:00:00.000Z",
    data: {
      participantName: "Ralf",
      selectedProposalIds: ["00000000-0000-4000-8000-000000000012"],
      submittedAt: "2026-06-09T00:00:00.000Z",
    },
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    meetingId: meeting.id,
    participantId: "00000000-0000-4000-8000-000000000202",
    createdAt: "2026-06-09T00:00:00.000Z",
    updatedAt: "2026-06-09T00:00:00.000Z",
    data: {
      participantName: "Alex",
      selectedProposalIds: [],
      submittedAt: "2026-06-09T00:00:00.000Z",
    },
  },
];

describe("buildProposalResults", () => {
  it("sorts by approval count and marks final proposals", () => {
    const results = buildProposalResults(meeting, votes);

    expect(results[0]).toMatchObject({
      id: "00000000-0000-4000-8000-000000000012",
      approvalCount: 1,
      approvalRatio: 0.5,
      approvedBy: ["Ralf"],
      declinedBy: ["Alex"],
      isFinal: true,
    });
  });
});
