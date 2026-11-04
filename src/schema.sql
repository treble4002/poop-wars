-- Poop Wars relational schema. Safe to run repeatedly.
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  name text NOT NULL,
  token_hash text UNIQUE,
  kind text NOT NULL DEFAULT 'user',          -- 'user' | 'guest' | 'bot'
  email text,
  auth_id text UNIQUE,                        -- Supabase auth user id
  birthdate date,
  owner_email text,                           -- parent email for ages 13-17
  premium boolean NOT NULL DEFAULT false,
  pilot boolean NOT NULL DEFAULT false,       -- pilot = lifetime premium
  invite_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS circles (
  id text PRIMARY KEY,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  owner_id text NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS circle_members (
  circle_id text NOT NULL REFERENCES circles(id),
  user_id text NOT NULL REFERENCES users(id),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (circle_id, user_id)
);
CREATE TABLE IF NOT EXISTS games (
  id text PRIMARY KEY,
  type text NOT NULL,
  circle_id text REFERENCES circles(id),
  p0 text NOT NULL REFERENCES users(id),
  p1 text NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'active',
  winner text,
  state jsonb NOT NULL,
  version integer NOT NULL DEFAULT 0,        -- optimistic concurrency check
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_ms bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS games_p0 ON games(p0);
CREATE INDEX IF NOT EXISTS games_p1 ON games(p1);
CREATE INDEX IF NOT EXISTS games_status ON games(status);
CREATE TABLE IF NOT EXISTS moves (
  id serial PRIMARY KEY,
  game_id text NOT NULL REFERENCES games(id),
  user_id text NOT NULL REFERENCES users(id),
  seq integer NOT NULL,                       -- game version this move produced
  body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, seq)
);
CREATE TABLE IF NOT EXISTS invite_codes (
  code text PRIMARY KEY,
  kind text NOT NULL DEFAULT 'pilot',         -- 'pilot' | 'premium'
  note text,
  used_by text REFERENCES users(id),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pending_signups (
  ticket_hash text PRIMARY KEY,
  auth_id text NOT NULL,
  email text NOT NULL,
  expires_ms bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS taunts (
  id serial PRIMARY KEY,
  game_id text NOT NULL REFERENCES games(id),
  from_id text NOT NULL REFERENCES users(id),
  to_id text NOT NULL REFERENCES users(id),
  taunt_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS blocks (
  blocker_id text NOT NULL REFERENCES users(id),
  blocked_id text NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);
CREATE TABLE IF NOT EXISTS reports (
  id serial PRIMARY KEY,
  reporter_id text NOT NULL REFERENCES users(id),
  reported_id text NOT NULL REFERENCES users(id),
  game_id text,
  taunt_id integer,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- added: where premium came from (invite, invite_pilot, open_pilot)
ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_source text;

-- added: free-text trash talk (max 60 chars), and reports keep a copy of the reported message
ALTER TABLE taunts ADD COLUMN IF NOT EXISTS body text;
ALTER TABLE taunts ALTER COLUMN taunt_key DROP NOT NULL;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS message text;

-- added: signup is a "13+ and rules" checkbox; we store when it was accepted. No birthdate or parent email is collected any more.
ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_rules_at timestamptz;
