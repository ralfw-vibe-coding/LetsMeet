import type { Handler, HandlerEvent } from "@netlify/functions";
import { ZodError } from "zod";
import { requireAdmin } from "../../src/server/admin";
import { findMeeting } from "../../src/server/db";
import { AppError, notFound } from "../../src/server/errors";
import { buildFinalIcs } from "../../src/server/ics";
import * as AdminChangePin from "../../src/server/Slices/AdminChangePin";
import * as AdminDeleteMeetings from "../../src/server/Slices/AdminDeleteMeetings";
import * as AdminListMeetings from "../../src/server/Slices/AdminListMeetings";
import * as AdminVerifyPin from "../../src/server/Slices/AdminVerifyPin";
import * as CloseVoting from "../../src/server/Slices/CloseVoting";
import * as CreateMeeting from "../../src/server/Slices/CreateMeeting";
import * as DeleteMeeting from "../../src/server/Slices/DeleteMeeting";
import * as GetOrganizerMeeting from "../../src/server/Slices/GetOrganizerMeeting";
import * as GetParticipantMeeting from "../../src/server/Slices/GetParticipantMeeting";
import * as SetFinalProposals from "../../src/server/Slices/SetFinalProposals";
import * as SubmitVote from "../../src/server/Slices/SubmitVote";
import * as UpdateMeeting from "../../src/server/Slices/UpdateMeeting";
import * as VerifyParticipantPin from "../../src/server/Slices/VerifyParticipantPin";
import { createMeetingRequestSchema, updateMeetingRequestSchema } from "../../src/shared/domain";

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}

function text(statusCode: number, body: string, contentType: string, headers: Record<string, string> = {}) {
  return {
    statusCode,
    headers: { "content-type": contentType, ...headers },
    body,
  };
}

function contentDispositionFilename(title: string): string {
  const filename = `${safeFilenamePart(title)} - final dates.ics`;
  const asciiFallback = asciiFilename(filename);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function safeFilenamePart(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "LetsMeet";
}

function asciiFilename(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_");
}

function routePath(event: HandlerEvent): string[] {
  const url = new URL(event.rawUrl);
  const path = url.pathname
    .replace(/^\/api\/?/, "")
    .replace(/^\/\.netlify\/functions\/api\/?/, "")
    .replace(/^\/+|\/+$/g, "");
  return path ? path.split("/") : [];
}

async function readJson(event: HandlerEvent): Promise<unknown> {
  if (!event.body) return {};
  return JSON.parse(event.body);
}

export const handler: Handler = async (event) => {
  try {
    const method = event.httpMethod.toUpperCase();
    const segments = routePath(event);

    if (segments[0] === "admin") {
      if (method === "POST" && segments[1] === "verify") {
        return json(200, await AdminVerifyPin.process(await readJson(event)));
      }

      const adminPin = event.headers["x-admin-pin"] ?? "";
      await requireAdmin(adminPin);

      if (method === "GET" && segments[1] === "meetings") {
        return json(200, await AdminListMeetings.process());
      }

      if (method === "POST" && segments[1] === "delete") {
        return json(200, await AdminDeleteMeetings.process(await readJson(event)));
      }

      if (method === "POST" && segments[1] === "pin") {
        return json(200, await AdminChangePin.process(adminPin, await readJson(event)));
      }
    }

    if (method === "POST" && segments.join("/") === "meetings") {
      const request = createMeetingRequestSchema.parse(await readJson(event));
      return json(201, await CreateMeeting.process(request));
    }

    if (segments[0] === "meetings" && segments[1]) {
      const meetingId = segments[1];

      if (method === "GET" && segments.length === 2) {
        const participantId = event.queryStringParameters?.participantId ?? null;
        const pinVerified = event.queryStringParameters?.pinVerified === "true";
        return json(200, await GetParticipantMeeting.process(meetingId, participantId, pinVerified));
      }

      if (method === "GET" && segments[2] === "edit" && segments[3]) {
        return json(200, await GetOrganizerMeeting.process(meetingId, segments[3]));
      }

      if (method === "PUT" && segments.length === 2) {
        const request = updateMeetingRequestSchema.parse(await readJson(event));
        return json(200, await UpdateMeeting.process(meetingId, request));
      }

      if (method === "DELETE" && segments.length === 2) {
        return json(200, await DeleteMeeting.process(meetingId, await readJson(event)));
      }

      if (method === "POST" && segments[2] === "pin") {
        return json(200, await VerifyParticipantPin.process(meetingId, await readJson(event)));
      }

      if (method === "POST" && segments[2] === "votes") {
        return json(200, await SubmitVote.process(meetingId, await readJson(event)));
      }

      if (method === "POST" && segments[2] === "close") {
        return json(200, await CloseVoting.process(meetingId, await readJson(event)));
      }

      if (method === "PUT" && segments[2] === "final-proposals") {
        return json(200, await SetFinalProposals.process(meetingId, await readJson(event)));
      }

      if (method === "GET" && segments[2] === "final.ics") {
        const meeting = await findMeeting(meetingId);
        if (!meeting) throw notFound();
        const ics = buildFinalIcs(meeting);
        if (!ics) throw notFound();
        return text(200, ics, "text/calendar; charset=utf-8", {
          "content-disposition": contentDispositionFilename(meeting.data.title),
        });
      }
    }

    throw notFound();
  } catch (error) {
    if (error instanceof AppError) {
      return json(error.status, { error: { code: error.code, message: error.message } });
    }

    if (error instanceof ZodError) {
      return json(400, { error: { code: "validation_error", message: error.issues[0]?.message ?? "Invalid request" } });
    }

    console.error(error);
    return json(500, { error: { code: "internal_error", message: "Internal server error" } });
  }
};
