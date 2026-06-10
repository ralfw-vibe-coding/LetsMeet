import pg from "pg";
import { type AppSettings, appSettingsSchema, meetingDataSchema, type MeetingData, type MeetingRecord, type VoteData, type VoteRecord, voteDataSchema } from "../shared/domain";

const { Pool } = pg;

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  pool ??= new Pool({ connectionString: process.env.DATABASE_URL });
  return pool;
}

function mapMeeting(row: Record<string, unknown>): MeetingRecord {
  return {
    id: String(row.id),
    editId: String(row.edit_id),
    data: meetingDataSchema.parse(row.data),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    closedAt: row.closed_at ? new Date(String(row.closed_at)).toISOString() : null,
  };
}

function mapVote(row: Record<string, unknown>): VoteRecord {
  return {
    id: String(row.id),
    meetingId: String(row.meeting_id),
    participantId: String(row.participant_id),
    data: voteDataSchema.parse(row.data),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export async function insertMeeting(id: string, editId: string, data: MeetingData): Promise<MeetingRecord> {
  const result = await getPool().query(
    `insert into meetings (id, edit_id, data)
     values ($1, $2, $3)
     returning *`,
    [id, editId, data],
  );
  return mapMeeting(result.rows[0]);
}

export async function findMeeting(id: string): Promise<MeetingRecord | null> {
  const result = await getPool().query("select * from meetings where id = $1", [id]);
  return result.rowCount ? mapMeeting(result.rows[0]) : null;
}

export async function findMeetingForEdit(id: string, editId: string): Promise<MeetingRecord | null> {
  const result = await getPool().query("select * from meetings where id = $1 and edit_id = $2", [id, editId]);
  return result.rowCount ? mapMeeting(result.rows[0]) : null;
}

export async function updateMeetingData(id: string, data: MeetingData, removedProposalIds: string[]): Promise<MeetingRecord> {
  const client = await getPool().connect();
  try {
    await client.query("begin");

    if (removedProposalIds.length > 0) {
      const votes = await client.query("select * from votes where meeting_id = $1", [id]);
      for (const row of votes.rows) {
        const vote = mapVote(row);
        const nextData: VoteData = {
          ...vote.data,
          selectedProposalIds: vote.data.selectedProposalIds.filter((proposalId) => !removedProposalIds.includes(proposalId)),
        };
        await client.query("update votes set data = $1, updated_at = now() where id = $2", [nextData, vote.id]);
      }
    }

    const result = await client.query(
      `update meetings
       set data = $2, updated_at = now()
       where id = $1
       returning *`,
      [id, data],
    );

    await client.query("commit");
    return mapMeeting(result.rows[0]);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function closeMeeting(id: string): Promise<MeetingRecord> {
  const result = await getPool().query(
    `update meetings
     set closed_at = coalesce(closed_at, now()), updated_at = now()
     where id = $1
     returning *`,
    [id],
  );
  return mapMeeting(result.rows[0]);
}

export async function deleteMeeting(id: string): Promise<void> {
  await getPool().query("delete from meetings where id = $1", [id]);
}

export async function deleteMeetings(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const result = await getPool().query("delete from meetings where id = any($1::uuid[])", [ids]);
  return result.rowCount ?? 0;
}

export type MeetingWithVoteCount = { meeting: MeetingRecord; participantCount: number };

export async function listMeetingsWithVoteCounts(): Promise<MeetingWithVoteCount[]> {
  const result = await getPool().query(
    `select m.*, coalesce(v.cnt, 0)::int as participant_count
     from meetings m
     left join (select meeting_id, count(*) as cnt from votes group by meeting_id) v
       on v.meeting_id = m.id
     order by m.created_at asc`,
  );
  return result.rows.map((row) => ({
    meeting: mapMeeting(row),
    participantCount: Number(row.participant_count),
  }));
}

const APP_SETTINGS_ID = "app";

export async function getAppSettings(): Promise<AppSettings> {
  const result = await getPool().query("select data from app_settings where id = $1", [APP_SETTINGS_ID]);
  return result.rowCount ? appSettingsSchema.parse(result.rows[0].data) : {};
}

export async function updateAppSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const next: AppSettings = { ...(await getAppSettings()), ...patch };
  await getPool().query(
    `insert into app_settings (id, data)
     values ($1, $2)
     on conflict (id) do update set data = excluded.data, updated_at = now()`,
    [APP_SETTINGS_ID, next],
  );
  return next;
}

export async function upsertVote(meetingId: string, participantId: string, data: VoteData): Promise<VoteRecord> {
  const id = crypto.randomUUID();
  const result = await getPool().query(
    `insert into votes (id, meeting_id, participant_id, data)
     values ($1, $2, $3, $4)
     on conflict (meeting_id, participant_id)
     do update set data = excluded.data, updated_at = now()
     returning *`,
    [id, meetingId, participantId, data],
  );
  return mapVote(result.rows[0]);
}

export async function listVotes(meetingId: string): Promise<VoteRecord[]> {
  const result = await getPool().query("select * from votes where meeting_id = $1 order by created_at", [meetingId]);
  return result.rows.map(mapVote);
}

export async function findVote(meetingId: string, participantId: string): Promise<VoteRecord | null> {
  const result = await getPool().query("select * from votes where meeting_id = $1 and participant_id = $2", [meetingId, participantId]);
  return result.rowCount ? mapVote(result.rows[0]) : null;
}
