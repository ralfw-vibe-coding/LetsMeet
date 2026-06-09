create table if not exists schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists meetings (
  id uuid primary key,
  edit_id uuid unique not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz null
);

create table if not exists votes (
  id uuid primary key,
  meeting_id uuid not null references meetings(id) on delete cascade,
  participant_id uuid not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(meeting_id, participant_id)
);

create index if not exists votes_meeting_id_idx on votes(meeting_id);
