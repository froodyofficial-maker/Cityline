-- =============================================================================
--  CITYLINE — database schema for Supabase
-- -----------------------------------------------------------------------------
--  How to use: Supabase dashboard → SQL Editor → New query → paste this whole
--  file → Run. It is safe to run again later (tables are only created when
--  missing; functions, triggers and policies are replaced).
--
--  What it sets up
--    • tables for profiles, servers, channels, roles, messages, DMs, friends…
--    • a Discord-style permission engine (roles + per-channel overwrites)
--    • Row Level Security on every table, so the browser can talk to the
--      database directly and only ever see what the signed-in user may see
--    • server-side functions (RPCs) for everything that needs extra checks
--    • the "media" storage bucket for avatars, icons, emoji and attachments
--    • realtime publication for live updates
--    • Cityline Neon (the premium tier): trials, gift codes, boosts
-- =============================================================================

set client_min_messages = warning;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------------------------
-- 0. Small helpers
-- -----------------------------------------------------------------------------

-- Permission bits. Keep in sync with src/lib/permissions.ts.
create or replace function public.perm(p_name text) returns bigint
language plpgsql immutable set search_path = public as $$
declare v bigint;
begin
  v := case p_name
    when 'VIEW_CHANNEL' then 1
    when 'SEND_MESSAGES' then 2
    when 'MANAGE_MESSAGES' then 4
    when 'MANAGE_CHANNELS' then 8
    when 'MANAGE_ROLES' then 16
    when 'MANAGE_SERVER' then 32
    when 'KICK_MEMBERS' then 64
    when 'BAN_MEMBERS' then 128
    when 'CREATE_INVITE' then 256
    when 'CHANGE_NICKNAME' then 512
    when 'MANAGE_NICKNAMES' then 1024
    when 'MANAGE_EXPRESSIONS' then 2048
    when 'MENTION_EVERYONE' then 4096
    when 'ADD_REACTIONS' then 8192
    when 'ATTACH_FILES' then 16384
    when 'EMBED_LINKS' then 32768
    when 'READ_HISTORY' then 65536
    when 'CONNECT' then 131072
    when 'SPEAK' then 262144
    when 'VIDEO' then 524288
    when 'MUTE_MEMBERS' then 1048576
    when 'DEAFEN_MEMBERS' then 2097152
    when 'MOVE_MEMBERS' then 4194304
    when 'MODERATE_MEMBERS' then 8388608
    when 'VIEW_AUDIT_LOG' then 16777216
    when 'CREATE_THREADS' then 33554432
    when 'SEND_IN_THREADS' then 67108864
    when 'USE_EXTERNAL_EMOJI' then 134217728
    when 'ADMINISTRATOR' then 268435456
    when 'MANAGE_EVENTS' then 536870912
    when 'USE_SOUNDBOARD' then 1073741824
    when 'MANAGE_THREADS' then 2147483648
    when 'CREATE_POLLS' then 4294967296
    when 'SEND_VOICE_MESSAGES' then 8589934592
    when 'ALL' then 17179869183
    when 'DEFAULT' then 14194565891   -- what @everyone gets in a new server
    when 'DM' then 14093901827        -- what everyone in a DM gets
  end;
  if v is null then
    raise exception 'Unknown permission %', p_name;
  end if;
  return v;
end $$;

-- Short random codes for invites and gift codes (no look-alike characters).
create or replace function public.random_code(p_len int default 8) returns text
language sql volatile set search_path = public as $$
  with a as (select 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'::text as s)
  select string_agg(substr(a.s, 1 + floor(random() * length(a.s))::int, 1), '')
  from a, generate_series(1, greatest(p_len, 1))
$$;

-- Pulls <@uuid> (users) or <@&uuid> (roles) mentions out of message text.
create or replace function public.extract_mentions(p_content text, p_kind text default 'user') returns uuid[]
language sql immutable set search_path = public as $$
  select coalesce(array(
    select distinct m[1]::uuid
    from regexp_matches(coalesce(p_content, ''),
      case when p_kind = 'role' then '<@&' else '<@' end
      || '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})>', 'g') as m), '{}')
$$;

-- -----------------------------------------------------------------------------
-- 1. Tables
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  display_name text,
  avatar_url text,
  banner_url text,                 -- Neon
  banner_color text,
  bio text not null default '',
  pronouns text not null default '',
  theme_colors text[],             -- Neon: [primary, accent] profile gradient
  avatar_decoration text,          -- Neon
  profile_effect text,             -- Neon
  name_effect text,                -- Neon: animated display-name styles
  status text not null default 'online' check (status in ('online','idle','dnd','invisible')),
  custom_status text,
  custom_status_emoji text,
  custom_status_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_.]{2,32}$'),
  constraint profiles_display_name_len check (display_name is null or char_length(display_name) between 1 and 32),
  constraint profiles_bio_len check (char_length(bio) <= 400),
  constraint profiles_pronouns_len check (char_length(pronouns) <= 40),
  constraint profiles_custom_status_len check (custom_status is null or char_length(custom_status) <= 128)
);
create unique index if not exists profiles_username_key on public.profiles (username);

create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Cityline Neon (premium). Rows are written only by server functions.
create table if not exists public.neon_subscriptions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  tier text not null check (tier in ('lite','neon')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  source text not null default 'code',
  trial_used_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.neon_codes (
  code text primary key,
  tier text not null default 'neon' check (tier in ('lite','neon')),
  days int not null default 30 check (days > 0),
  max_uses int not null default 1 check (max_uses >= 0),   -- 0 = unlimited
  uses int not null default 0,
  expires_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.neon_code_redemptions (
  code text not null references public.neon_codes(code) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (code, user_id)
);

create table if not exists public.servers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  description text not null default '' check (char_length(description) <= 300),
  icon_url text,
  banner_url text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  is_public boolean not null default false,
  tags text[] not null default '{}',
  system_channel_id uuid,
  welcome_message text not null default '' check (char_length(welcome_message) <= 500),
  xp_enabled boolean not null default true,
  accent_color text,
  created_at timestamptz not null default now()
);
create index if not exists servers_public_idx on public.servers (is_public) where is_public;

create table if not exists public.server_members (
  server_id uuid not null references public.servers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  nickname text check (nickname is null or char_length(nickname) between 1 and 32),
  avatar_url text,                 -- Neon: per-server avatar
  joined_at timestamptz not null default now(),
  timeout_until timestamptz,
  xp int not null default 0,
  last_xp_at timestamptz,
  primary key (server_id, user_id)
);
create index if not exists server_members_user_idx on public.server_members (user_id);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  color text,
  color2 text,                     -- gradient role colours (boost level 2)
  icon text,                       -- emoji shown next to names (boost level 1)
  hoist boolean not null default false,
  mentionable boolean not null default false,
  position int not null default 0,
  permissions bigint not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists roles_server_idx on public.roles (server_id);
create unique index if not exists roles_one_default on public.roles (server_id) where is_default;

create table if not exists public.member_roles (
  server_id uuid not null,
  user_id uuid not null,
  role_id uuid not null references public.roles(id) on delete cascade,
  primary key (user_id, role_id),
  foreign key (server_id, user_id) references public.server_members(server_id, user_id) on delete cascade
);
create index if not exists member_roles_server_idx on public.member_roles (server_id);
create index if not exists member_roles_role_idx on public.member_roles (role_id);

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  server_id uuid references public.servers(id) on delete cascade,
  type text not null check (type in ('text','voice','announcement','forum','stage','category','dm','group_dm','thread')),
  name text not null default '' check (char_length(name) <= 100),
  topic text not null default '' check (char_length(topic) <= 1024),
  position int not null default 0,
  parent_id uuid references public.channels(id) on delete set null,          -- category
  thread_parent_id uuid references public.channels(id) on delete cascade,    -- parent of a thread
  starter_message_id uuid,
  owner_id uuid references public.profiles(id) on delete set null,
  icon_url text,
  nsfw boolean not null default false,
  slowmode_seconds int not null default 0 check (slowmode_seconds between 0 and 21600),
  user_limit int not null default 0 check (user_limit between 0 and 99),
  archived boolean not null default false,
  locked boolean not null default false,
  available_tags jsonb not null default '[]'::jsonb,
  applied_tags text[] not null default '{}',
  emoji text,
  dm_key text unique,
  last_message_at timestamptz,
  message_count int not null default 0,
  created_at timestamptz not null default now(),
  constraint channels_server_required check ((type in ('dm','group_dm')) = (server_id is null)),
  constraint channels_thread_parent check ((type = 'thread') = (thread_parent_id is not null))
);
create index if not exists channels_server_idx on public.channels (server_id);
create index if not exists channels_thread_parent_idx on public.channels (thread_parent_id) where thread_parent_id is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'servers_system_channel_fk') then
    alter table public.servers add constraint servers_system_channel_fk
      foreign key (system_channel_id) references public.channels(id) on delete set null;
  end if;
end $$;

create table if not exists public.channel_recipients (
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  closed boolean not null default false,
  added_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);
create index if not exists channel_recipients_user_idx on public.channel_recipients (user_id);

create table if not exists public.permission_overwrites (
  channel_id uuid not null references public.channels(id) on delete cascade,
  target_id uuid not null,
  target_type text not null check (target_type in ('role','member')),
  allow bigint not null default 0,
  deny bigint not null default 0,
  primary key (channel_id, target_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  server_id uuid references public.servers(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  type text not null default 'default' check (type in ('default','join','pin','boost','call','thread','system')),
  content text not null default '' check (char_length(content) <= 4000),
  attachments jsonb not null default '[]'::jsonb,
  embeds jsonb not null default '[]'::jsonb,
  sticker jsonb,
  poll jsonb,
  forwarded jsonb,
  effect text,
  reply_to_id uuid references public.messages(id) on delete set null,
  thread_id uuid references public.channels(id) on delete set null,
  mentions uuid[] not null default '{}',
  mention_roles uuid[] not null default '{}',
  mention_everyone boolean not null default false,
  pinned boolean not null default false,
  pinned_at timestamptz,
  flags int not null default 0,     -- 1 silent · 2 hide embeds · 4 voice message · 16 reply without ping
  nonce text,
  edited_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists messages_channel_created_idx on public.messages (channel_id, created_at desc);
create index if not exists messages_author_idx on public.messages (author_id);
create index if not exists messages_mentions_idx on public.messages using gin (mentions);
create index if not exists messages_pinned_idx on public.messages (channel_id) where pinned;
create index if not exists messages_content_trgm_idx on public.messages using gin (content extensions.gin_trgm_ops);

create table if not exists public.reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 80),
  is_super boolean not null default false,
  channel_id uuid not null references public.channels(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji, is_super)
);
create index if not exists reactions_message_idx on public.reactions (message_id);

create table if not exists public.poll_votes (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  option_id text not null,
  channel_id uuid not null references public.channels(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, option_id)
);

create table if not exists public.read_states (
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  mention_count int not null default 0,
  primary key (user_id, channel_id)
);

create table if not exists public.relationships (
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('friend','incoming','outgoing','blocked')),
  created_at timestamptz not null default now(),
  primary key (user_id, target_id),
  check (user_id <> target_id)
);
create index if not exists relationships_target_idx on public.relationships (target_id);

create table if not exists public.invites (
  code text primary key default public.random_code(8),
  server_id uuid not null references public.servers(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete cascade,
  inviter_id uuid references public.profiles(id) on delete set null,
  max_uses int not null default 0 check (max_uses >= 0),
  uses int not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists invites_server_idx on public.invites (server_id);

create table if not exists public.bans (
  server_id uuid not null references public.servers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text,
  banned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (server_id, user_id)
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  server_id uuid not null references public.servers(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  changes jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_server_idx on public.audit_log (server_id, created_at desc);

create table if not exists public.emojis (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers(id) on delete cascade,
  name text not null check (name ~ '^[A-Za-z0-9_]{2,32}$'),
  url text not null,
  animated boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (server_id, name)
);

create table if not exists public.stickers (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 30),
  description text not null default '',
  url text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.soundboard_sounds (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 32),
  emoji text,
  url text not null,
  volume real not null default 1 check (volume between 0 and 1),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.server_events (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete set null,
  location text,
  name text not null check (char_length(name) between 1 and 100),
  description text not null default '' check (char_length(description) <= 1000),
  image_url text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled','active','completed','canceled')),
  creator_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists server_events_server_idx on public.server_events (server_id, starts_at);

create table if not exists public.event_rsvps (
  event_id uuid not null references public.server_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  server_id uuid not null references public.servers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table if not exists public.boosts (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists boosts_server_idx on public.boosts (server_id);
create index if not exists boosts_user_idx on public.boosts (user_id);

create table if not exists public.bookmarks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  primary key (user_id, message_id)
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  message_id uuid references public.messages(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete cascade,
  note text not null default '',
  remind_at timestamptz not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists reminders_user_idx on public.reminders (user_id, remind_at);

create table if not exists public.scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 4000),
  send_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists scheduled_messages_due_idx on public.scheduled_messages (send_at);

create table if not exists public.notification_settings (
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null,           -- a server or a channel
  level text not null default 'default' check (level in ('default','all','mentions','nothing')),
  muted boolean not null default false,
  muted_until timestamptz,
  primary key (user_id, target_id)
);

create table if not exists public.automod_rules (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers(id) on delete cascade,
  name text not null default 'Rule',
  type text not null check (type in ('keyword','links','invites','mention_spam','caps')),
  keywords text[] not null default '{}',
  mention_limit int not null default 5,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists automod_rules_server_idx on public.automod_rules (server_id);

-- -----------------------------------------------------------------------------
-- 2. Permission engine
--    Functions taking a p_user argument are internal (not callable from the
--    browser); the *_perm / can_* wrappers below always use the signed-in user.
-- -----------------------------------------------------------------------------

create or replace function public.neon_tier(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select tier from neon_subscriptions where user_id = p_user and expires_at > now()
$$;

create or replace function public.server_permissions(p_server uuid, p_user uuid) returns bigint
language plpgsql stable security definer set search_path = public as $$
declare
  v_owner uuid;
  v_perms bigint;
  v_timeout timestamptz;
begin
  if p_user is null then return 0; end if;
  select owner_id into v_owner from servers where id = p_server;
  if not found then return 0; end if;
  if v_owner = p_user then return perm('ALL'); end if;
  select timeout_until into v_timeout from server_members where server_id = p_server and user_id = p_user;
  if not found then return 0; end if;
  select coalesce(bit_or(r.permissions), 0) into v_perms
  from roles r
  where r.server_id = p_server
    and (r.is_default or exists (select 1 from member_roles mr where mr.role_id = r.id and mr.user_id = p_user));
  if (v_perms & perm('ADMINISTRATOR')) <> 0 then return perm('ALL'); end if;
  if v_timeout is not null and v_timeout > now() then
    v_perms := v_perms & (perm('VIEW_CHANNEL') | perm('READ_HISTORY') | perm('CONNECT'));
  end if;
  return v_perms;
end $$;

-- Works from the channel's own columns, so it also answers for a row that is
-- being inserted right now (INSERT … RETURNING checks the SELECT policy).
create or replace function public.channel_permissions_for(
  p_channel uuid, p_server uuid, p_type text, p_parent uuid, p_thread_parent uuid, p_locked boolean, p_user uuid
) returns bigint
language plpgsql stable security definer set search_path = public as $$
declare
  ch record;
  v_base bigint;
  v_allow bigint;
  v_deny bigint;
  v_src uuid;
  v_everyone uuid;
  v_timeout timestamptz;
  v_explicit_send boolean := false;
begin
  if p_user is null then return 0; end if;
  select p_channel as id, p_server as server_id, p_type as type, p_parent as parent_id,
         p_thread_parent as thread_parent_id, coalesce(p_locked, false) as locked into ch;

  if ch.type in ('dm', 'group_dm') then
    if exists (select 1 from channel_recipients where channel_id = p_channel and user_id = p_user) then
      return perm('DM');
    end if;
    return 0;
  end if;

  -- Threads inherit from their parent; "send" there means "send in threads".
  if ch.type = 'thread' then
    v_base := channel_permissions(ch.thread_parent_id, p_user);
    if v_base = 0 then return 0; end if;
    if (v_base & perm('SEND_IN_THREADS')) <> 0
       and (not ch.locked or (v_base & perm('MANAGE_THREADS')) <> 0) then
      v_base := v_base | perm('SEND_MESSAGES');
    else
      v_base := v_base & ~perm('SEND_MESSAGES');
    end if;
    return v_base;
  end if;

  v_base := server_permissions(ch.server_id, p_user);
  if v_base = 0 then return 0; end if;
  if v_base = perm('ALL') then return v_base; end if;

  -- A channel without its own overwrites follows its category ("synced").
  v_src := p_channel;
  if ch.parent_id is not null and not exists (select 1 from permission_overwrites where channel_id = p_channel) then
    v_src := ch.parent_id;
  end if;

  select id into v_everyone from roles where server_id = ch.server_id and is_default;

  select o.allow, o.deny into v_allow, v_deny from permission_overwrites o
  where o.channel_id = v_src and o.target_id = v_everyone;
  if found then
    v_base := (v_base & ~v_deny) | v_allow;
    v_explicit_send := (v_allow & perm('SEND_MESSAGES')) <> 0;
  end if;

  select coalesce(bit_or(o.allow), 0), coalesce(bit_or(o.deny), 0) into v_allow, v_deny
  from permission_overwrites o
  join member_roles mr on mr.role_id = o.target_id and mr.user_id = p_user
  where o.channel_id = v_src and o.target_type = 'role';
  v_base := (v_base & ~v_deny) | v_allow;
  v_explicit_send := v_explicit_send or (v_allow & perm('SEND_MESSAGES')) <> 0;

  select o.allow, o.deny into v_allow, v_deny from permission_overwrites o
  where o.channel_id = v_src and o.target_id = p_user and o.target_type = 'member';
  if found then
    v_base := (v_base & ~v_deny) | v_allow;
    v_explicit_send := v_explicit_send or (v_allow & perm('SEND_MESSAGES')) <> 0;
  end if;

  if (v_base & perm('VIEW_CHANNEL')) = 0 then return 0; end if;

  -- Announcement channels: only moderators (or explicitly allowed roles) post.
  if ch.type = 'announcement' and (v_base & perm('MANAGE_MESSAGES')) = 0 and not v_explicit_send then
    v_base := v_base & ~perm('SEND_MESSAGES');
  end if;

  select timeout_until into v_timeout from server_members where server_id = ch.server_id and user_id = p_user;
  if v_timeout is not null and v_timeout > now() then
    v_base := v_base & (perm('VIEW_CHANNEL') | perm('READ_HISTORY') | perm('CONNECT'));
  end if;
  return v_base;
end $$;

create or replace function public.channel_permissions(p_channel uuid, p_user uuid) returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce((select channel_permissions_for(c.id, c.server_id, c.type, c.parent_id, c.thread_parent_id, c.locked, p_user)
                   from channels c where c.id = p_channel), 0)
$$;

create or replace function public.can_view_channel_row(
  p_channel uuid, p_server uuid, p_type text, p_parent uuid, p_thread_parent uuid, p_locked boolean
) returns boolean
language sql stable security definer set search_path = public as $$
  select (channel_permissions_for(p_channel, p_server, p_type, p_parent, p_thread_parent, p_locked, auth.uid())
          & perm('VIEW_CHANNEL')) <> 0
$$;

create or replace function public.member_top_position(p_server uuid, p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(max(r.position), 0)
  from member_roles mr join roles r on r.id = mr.role_id
  where mr.server_id = p_server and mr.user_id = p_user
$$;

-- true when p_actor sits above p_target in the role hierarchy
create or replace function public.outranks(p_server uuid, p_actor uuid, p_target uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_owner uuid;
begin
  select owner_id into v_owner from servers where id = p_server;
  if p_target = v_owner then return false; end if;
  if p_actor = v_owner then return true; end if;
  return member_top_position(p_server, p_actor) > member_top_position(p_server, p_target);
end $$;

create or replace function public.is_member(p_server uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from server_members where server_id = p_server and user_id = auth.uid())
$$;

create or replace function public.is_recipient(p_channel uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from channel_recipients where channel_id = p_channel and user_id = auth.uid())
$$;

create or replace function public.has_server_perm(p_server uuid, p_perm bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select (server_permissions(p_server, auth.uid()) & p_perm) = p_perm
$$;

create or replace function public.has_channel_perm(p_channel uuid, p_perm bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select (channel_permissions(p_channel, auth.uid()) & p_perm) = p_perm
$$;

create or replace function public.can_view_channel(p_channel uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (channel_permissions(p_channel, auth.uid()) & perm('VIEW_CHANNEL')) <> 0
$$;

create or replace function public.can_read_channel(p_channel uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (channel_permissions(p_channel, auth.uid()) & (perm('VIEW_CHANNEL') | perm('READ_HISTORY')))
         = (perm('VIEW_CHANNEL') | perm('READ_HISTORY'))
$$;

create or replace function public.my_channel_perms(p_channel uuid) returns bigint
language sql stable security definer set search_path = public as $$
  select channel_permissions(p_channel, auth.uid())
$$;

create or replace function public.my_server_perms(p_server uuid) returns bigint
language sql stable security definer set search_path = public as $$
  select server_permissions(p_server, auth.uid())
$$;

create or replace function public.my_top_position(p_server uuid) returns int
language sql stable security definer set search_path = public as $$
  select member_top_position(p_server, auth.uid())
$$;

create or replace function public.can_manage_role(p_role uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare r record; v_uid uuid := auth.uid();
begin
  select server_id, position, is_default into r from roles where id = p_role;
  if not found then return false; end if;
  if exists (select 1 from servers where id = r.server_id and owner_id = v_uid) then return true; end if;
  if (server_permissions(r.server_id, v_uid) & perm('MANAGE_ROLES')) = 0 then return false; end if;
  return r.position < member_top_position(r.server_id, v_uid);
end $$;

create or replace function public.server_boost_count(p_server uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from boosts b where b.server_id = p_server and neon_tier(b.user_id) = 'neon'
$$;

create or replace function public.boost_level(p_server uuid) returns int
language sql stable security definer set search_path = public as $$
  select case when c >= 14 then 3 when c >= 7 then 2 when c >= 2 then 1 else 0 end
  from (select server_boost_count(p_server) as c) x
$$;

-- -----------------------------------------------------------------------------
-- 3. JSON builders used by the read functions
-- -----------------------------------------------------------------------------

create or replace function public.profile_json(p public.profiles) returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(p) || jsonb_build_object('neon', neon_tier(p.id))
$$;

create or replace function public.member_json(m public.server_members) returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(m) || jsonb_build_object(
    'roles', coalesce((select jsonb_agg(mr.role_id) from member_roles mr where mr.server_id = m.server_id and mr.user_id = m.user_id), '[]'::jsonb))
$$;

create or replace function public.message_json(m public.messages, p_viewer uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(m) || jsonb_build_object(
    'reactions', coalesce((
      select jsonb_agg(jsonb_build_object('emoji', x.emoji, 'count', x.cnt, 'super_count', x.super_cnt, 'me', x.me, 'me_super', x.me_super) order by x.first_at)
      from (
        select r.emoji,
               count(*) filter (where not r.is_super) as cnt,
               count(*) filter (where r.is_super) as super_cnt,
               coalesce(bool_or(r.user_id = p_viewer and not r.is_super), false) as me,
               coalesce(bool_or(r.user_id = p_viewer and r.is_super), false) as me_super,
               min(r.created_at) as first_at
        from reactions r where r.message_id = m.id group by r.emoji
      ) x), '[]'::jsonb),
    'poll_results', case when m.poll is null then null else coalesce((
      select jsonb_agg(jsonb_build_object('option_id', v.option_id, 'count', v.cnt, 'me', v.me))
      from (
        select pv.option_id, count(*) as cnt, bool_or(pv.user_id = p_viewer) as me
        from poll_votes pv where pv.message_id = m.id group by pv.option_id
      ) v), '[]'::jsonb) end,
    'reply', case when m.reply_to_id is null then null else (
      select jsonb_build_object('id', r.id, 'author_id', r.author_id, 'content', left(r.content, 200),
                                'attachments', jsonb_array_length(r.attachments), 'type', r.type)
      from messages r where r.id = m.reply_to_id) end,
    'thread', case when m.thread_id is null then null else (
      select jsonb_build_object('id', t.id, 'name', t.name, 'message_count', t.message_count, 'last_message_at', t.last_message_at, 'archived', t.archived)
      from channels t where t.id = m.thread_id) end
  )
$$;

-- -----------------------------------------------------------------------------
-- 4. Triggers
-- -----------------------------------------------------------------------------

-- New sign-up → profile + settings row.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_base text;
  v_name text;
  v_display text;
  v_try int := 0;
begin
  v_base := lower(coalesce(nullif(v_meta->>'username', ''), nullif(v_meta->>'user_name', ''),
                           nullif(v_meta->>'preferred_username', ''), split_part(coalesce(new.email, ''), '@', 1), 'user'));
  v_base := regexp_replace(v_base, '[^a-z0-9_.]', '', 'g');
  if char_length(v_base) < 2 then v_base := 'user' || v_base; end if;
  v_base := left(v_base, 26);
  v_name := v_base;
  while exists (select 1 from profiles where username = v_name) loop
    v_try := v_try + 1;
    v_name := v_base || (floor(random() * 9000) + 1000)::int::text;
    if v_try > 50 then v_name := left(v_base, 20) || substr(md5(random()::text), 1, 8); end if;
  end loop;
  v_display := left(coalesce(nullif(btrim(v_meta->>'display_name'), ''), nullif(btrim(v_meta->>'full_name'), ''),
                             nullif(btrim(v_meta->>'name'), ''), v_name), 32);
  insert into profiles (id, username, display_name, avatar_url)
  values (new.id, v_name, v_display, nullif(v_meta->>'avatar_url', ''))
  on conflict (id) do nothing;
  insert into user_settings (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- The guard triggers below run as the caller (security invoker) so they can
-- tell a write that came straight from the browser (current_user is
-- 'authenticated') from one made by a trusted function or a cascade.

-- Profiles: keep usernames tidy and Neon-only fields for Neon members.
create or replace function public.profiles_before_update() returns trigger
language plpgsql set search_path = public as $$
declare v_neon boolean;
begin
  new.id := old.id;
  new.created_at := old.created_at;
  new.username := lower(btrim(new.username));
  new.updated_at := now();
  if current_user <> 'authenticated' then return new; end if;
  v_neon := neon_tier(old.id) = 'neon';
  if not coalesce(v_neon, false) then
    if new.banner_url is distinct from old.banner_url and new.banner_url is not null then
      raise exception 'Profile banners are a Neon perk' using errcode = 'P0001';
    end if;
    if new.theme_colors is distinct from old.theme_colors and new.theme_colors is not null then
      raise exception 'Profile themes are a Neon perk' using errcode = 'P0001';
    end if;
    if new.avatar_decoration is distinct from old.avatar_decoration and new.avatar_decoration is not null then
      raise exception 'Avatar decorations are a Neon perk' using errcode = 'P0001';
    end if;
    if new.profile_effect is distinct from old.profile_effect and new.profile_effect is not null then
      raise exception 'Profile effects are a Neon perk' using errcode = 'P0001';
    end if;
    if new.name_effect is distinct from old.name_effect and new.name_effect is not null then
      raise exception 'Name styles are a Neon perk' using errcode = 'P0001';
    end if;
    if char_length(new.bio) > 190 and new.bio is distinct from old.bio then
      raise exception 'About Me is limited to 190 characters (400 with Neon)' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profiles_before_update on public.profiles;
create trigger profiles_before_update before update on public.profiles
  for each row execute function public.profiles_before_update();

-- Servers: ownership changes only by the owner, banner needs boost level 2.
create or replace function public.servers_before_update() returns trigger
language plpgsql set search_path = public as $$
begin
  new.id := old.id;
  new.created_at := old.created_at;
  if current_user <> 'authenticated' then return new; end if;
  if new.owner_id <> old.owner_id then
    if auth.uid() <> old.owner_id then
      raise exception 'Only the owner can transfer the server' using errcode = '42501';
    end if;
    if not exists (select 1 from server_members where server_id = new.id and user_id = new.owner_id) then
      raise exception 'The new owner must be a member of the server' using errcode = 'P0001';
    end if;
  end if;
  if new.banner_url is distinct from old.banner_url and new.banner_url is not null and boost_level(new.id) < 2 then
    raise exception 'Server banners unlock at Boost Level 2' using errcode = 'P0001';
  end if;
  if new.system_channel_id is distinct from old.system_channel_id and new.system_channel_id is not null
     and not exists (select 1 from channels where id = new.system_channel_id and server_id = new.id) then
    raise exception 'System channel must belong to this server' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists servers_before_update on public.servers;
create trigger servers_before_update before update on public.servers
  for each row execute function public.servers_before_update();

-- Roles: no granting permissions you do not have, no editing above yourself.
create or replace function public.roles_guard() returns trigger
language plpgsql set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_owner boolean;
  v_mine bigint;
  v_top int;
begin
  if current_user <> 'authenticated' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if old.is_default then raise exception 'The @everyone role cannot be deleted' using errcode = 'P0001'; end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    new.server_id := old.server_id;
    new.is_default := old.is_default;
    if old.is_default then
      new.position := 0;
      new.name := '@everyone';
    end if;
  else
    new.is_default := false;
  end if;
  if not new.is_default and new.position < 1 then new.position := 1; end if;
  v_owner := exists (select 1 from servers where id = new.server_id and owner_id = v_uid);
  if v_owner then return new; end if;
  v_mine := my_server_perms(new.server_id);
  v_top := my_top_position(new.server_id);
  if v_mine <> perm('ALL') and (new.permissions & ~v_mine) <> 0
     and (tg_op = 'INSERT' or new.permissions <> old.permissions) then
    raise exception 'You cannot grant permissions you do not have' using errcode = '42501';
  end if;
  if not new.is_default and new.position >= v_top then
    raise exception 'Roles must stay below your highest role' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists roles_guard on public.roles;
create trigger roles_guard before insert or update or delete on public.roles
  for each row execute function public.roles_guard();

-- member_roles: fill in server_id, never assign @everyone.
create or replace function public.member_roles_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select server_id, is_default into r from roles where id = new.role_id;
  if not found then raise exception 'Unknown role' using errcode = 'P0001'; end if;
  if r.is_default then raise exception 'Everyone already has @everyone' using errcode = 'P0001'; end if;
  new.server_id := r.server_id;
  return new;
end $$;

drop trigger if exists member_roles_before_insert on public.member_roles;
create trigger member_roles_before_insert before insert on public.member_roles
  for each row execute function public.member_roles_before_insert();

-- Channels: type and server never change; thread rules.
create or replace function public.channels_guard() returns trigger
language plpgsql set search_path = public as $$
declare p record;
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.type := old.type;
    new.server_id := old.server_id;
    new.thread_parent_id := old.thread_parent_id;
    new.dm_key := old.dm_key;
    new.created_at := old.created_at;
    if current_user = 'authenticated' then
      new.message_count := old.message_count;
      new.last_message_at := old.last_message_at;
      new.starter_message_id := old.starter_message_id;
      if old.type = 'group_dm' then
        new.owner_id := old.owner_id;
      end if;
    end if;
  else
    if new.type = 'thread' then
      select server_id, type into p from channels where id = new.thread_parent_id;
      if not found or p.type not in ('text','announcement','forum') then
        raise exception 'Threads can only be created in text, announcement or forum channels' using errcode = 'P0001';
      end if;
      new.server_id := p.server_id;
      new.parent_id := null;
      if new.owner_id is null then new.owner_id := auth.uid(); end if;
    elsif new.type <> 'category' and new.parent_id is not null then
      if not exists (select 1 from channels where id = new.parent_id and type = 'category' and server_id = new.server_id) then
        new.parent_id := null;
      end if;
    end if;
    new.message_count := 0;
    new.last_message_at := null;
  end if;
  if new.type = 'category' then new.parent_id := null; end if;
  if new.type in ('text','announcement','forum') then
    new.name := left(regexp_replace(lower(btrim(new.name)), '[\s]+', '-', 'g'), 100);
  end if;
  if new.type in ('text','announcement','forum','voice','stage','category','thread') and btrim(new.name) = '' then
    raise exception 'Channel name is required' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists channels_guard on public.channels;
create trigger channels_guard before insert or update on public.channels
  for each row execute function public.channels_guard();

-- Messages: validation, mentions, slowmode, AutoMod.
create or replace function public.messages_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ch record;
  v_perms bigint;
  v_tier text;
  v_limit int;
  v_last timestamptz;
  v_rule record;
  v_word text;
  v_reply_author uuid;
  v_letters int;
begin
  select id, server_id, type, slowmode_seconds into ch from channels where id = new.channel_id;
  if not found then raise exception 'Unknown channel' using errcode = 'P0001'; end if;
  if ch.type in ('category') then raise exception 'You cannot post in a category' using errcode = 'P0001'; end if;
  if ch.type = 'forum' and new.type = 'default' then raise exception 'Create a post to talk in a forum' using errcode = 'P0001'; end if;

  new.server_id := ch.server_id;
  new.created_at := now();
  new.edited_at := null;
  new.pinned := false;
  new.pinned_at := null;
  new.thread_id := null;
  new.mentions := extract_mentions(new.content, 'user');
  new.mention_roles := extract_mentions(new.content, 'role');
  new.mention_everyone := false;

  if new.reply_to_id is not null then
    select author_id into v_reply_author from messages where id = new.reply_to_id and channel_id = new.channel_id;
    if not found then
      new.reply_to_id := null;
    elsif v_reply_author is not null and v_reply_author is distinct from new.author_id and (new.flags & 16) = 0 then
      new.mentions := array(select distinct x from unnest(new.mentions || v_reply_author) as x);
    end if;
  end if;

  if new.type <> 'default' then return new; end if;   -- system messages come from trusted functions

  if new.author_id is null then raise exception 'Messages need an author' using errcode = 'P0001'; end if;
  v_perms := channel_permissions(new.channel_id, new.author_id);
  if (v_perms & perm('SEND_MESSAGES')) = 0 then
    raise exception 'You do not have permission to send messages here' using errcode = '42501';
  end if;

  if ch.type = 'dm' and exists (
    select 1 from channel_recipients cr
    join relationships r on r.type = 'blocked'
      and ((r.user_id = cr.user_id and r.target_id = new.author_id) or (r.user_id = new.author_id and r.target_id = cr.user_id))
    where cr.channel_id = new.channel_id and cr.user_id <> new.author_id) then
    raise exception 'Your message could not be delivered. You may not share a server, or one of you has blocked the other.' using errcode = 'P0001';
  end if;

  v_tier := neon_tier(new.author_id);
  v_limit := case when v_tier = 'neon' then 4000 else 2000 end;
  if char_length(new.content) > v_limit then
    raise exception 'Messages can be up to % characters%', v_limit,
      case when v_tier = 'neon' then '' else ' (4000 with Neon)' end using errcode = 'P0001';
  end if;
  if jsonb_typeof(new.attachments) <> 'array' then new.attachments := '[]'::jsonb; end if;
  if btrim(new.content) = '' and jsonb_array_length(new.attachments) = 0 and new.sticker is null
     and new.poll is null and new.forwarded is null then
    raise exception 'Message is empty' using errcode = 'P0001';
  end if;
  if jsonb_array_length(new.attachments) > 10 then
    raise exception 'Up to 10 attachments per message' using errcode = 'P0001';
  end if;
  if jsonb_array_length(new.attachments) > 0 and (v_perms & perm('ATTACH_FILES')) = 0 then
    raise exception 'You do not have permission to attach files here' using errcode = '42501';
  end if;
  if (new.flags & 4) <> 0 and (v_perms & perm('SEND_VOICE_MESSAGES')) = 0 then
    raise exception 'You cannot send voice messages here' using errcode = '42501';
  end if;
  if new.poll is not null then
    if (v_perms & perm('CREATE_POLLS')) = 0 then
      raise exception 'You cannot create polls here' using errcode = '42501';
    end if;
    if jsonb_typeof(new.poll->'options') <> 'array' or jsonb_array_length(new.poll->'options') not between 1 and 10
       or coalesce(btrim(new.poll->>'question'), '') = '' then
      raise exception 'Polls need a question and 1–10 answers' using errcode = 'P0001';
    end if;
  end if;
  if new.effect is not null and v_tier is distinct from 'neon' then new.effect := null; end if;

  if ch.server_id is not null then
    if new.content ~ '@(everyone|here)' and (v_perms & perm('MENTION_EVERYONE')) <> 0 then
      new.mention_everyone := true;
    end if;
    new.mention_roles := coalesce(array(
      select r.id from roles r where r.id = any(new.mention_roles) and r.server_id = ch.server_id and not r.is_default
        and (r.mentionable or (v_perms & perm('MENTION_EVERYONE')) <> 0)), '{}');

    if ch.slowmode_seconds > 0 and (v_perms & (perm('MANAGE_MESSAGES') | perm('MANAGE_CHANNELS'))) = 0 then
      select max(created_at) into v_last from messages where channel_id = new.channel_id and author_id = new.author_id and type = 'default';
      if v_last is not null and v_last > now() - make_interval(secs => ch.slowmode_seconds) then
        raise exception 'Slowmode is on — wait % more seconds', ceil(extract(epoch from (v_last + make_interval(secs => ch.slowmode_seconds) - now())))::int
          using errcode = 'P0001';
      end if;
    end if;

    if (v_perms & perm('MANAGE_SERVER')) = 0 then
      for v_rule in select * from automod_rules where server_id = ch.server_id and enabled loop
        if v_rule.type = 'keyword' then
          foreach v_word in array v_rule.keywords loop
            if btrim(v_word) <> '' and position(lower(btrim(v_word)) in lower(new.content)) > 0 then
              raise exception 'AutoMod blocked your message (%)', v_rule.name using errcode = 'P0001';
            end if;
          end loop;
        elsif v_rule.type = 'links' and new.content ~* '(https?://|www\.)' then
          raise exception 'AutoMod blocked your message: links are not allowed here' using errcode = 'P0001';
        elsif v_rule.type = 'invites' and new.content ~* '(invite/|#/invite/)[A-Za-z0-9]{4,}' then
          raise exception 'AutoMod blocked your message: invite links are not allowed here' using errcode = 'P0001';
        elsif v_rule.type = 'mention_spam' and cardinality(new.mentions) + cardinality(new.mention_roles) > v_rule.mention_limit then
          raise exception 'AutoMod blocked your message: too many mentions' using errcode = 'P0001';
        elsif v_rule.type = 'caps' then
          v_letters := char_length(regexp_replace(new.content, '[^A-Za-z]', '', 'g'));
          if v_letters >= 12 and char_length(regexp_replace(new.content, '[^A-Z]', '', 'g'))::numeric / v_letters > 0.7 then
            raise exception 'AutoMod blocked your message: too many capital letters' using errcode = 'P0001';
          end if;
        end if;
      end loop;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists messages_before_insert on public.messages;
create trigger messages_before_insert before insert on public.messages
  for each row execute function public.messages_before_insert();

create or replace function public.messages_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update channels set last_message_at = new.created_at, message_count = message_count + 1 where id = new.channel_id;

  if new.author_id is not null then
    insert into read_states (user_id, channel_id, last_read_at, mention_count)
    values (new.author_id, new.channel_id, new.created_at, 0)
    on conflict (user_id, channel_id) do update
      set last_read_at = greatest(read_states.last_read_at, excluded.last_read_at), mention_count = 0;
  end if;

  if new.server_id is null then
    update channel_recipients set closed = false where channel_id = new.channel_id and closed;
    if new.type in ('default', 'call') then
      insert into read_states (user_id, channel_id, last_read_at, mention_count)
      select cr.user_id, new.channel_id, 'epoch', 1
      from channel_recipients cr
      where cr.channel_id = new.channel_id and cr.user_id is distinct from new.author_id
      on conflict (user_id, channel_id) do update set mention_count = read_states.mention_count + 1;
    end if;
  else
    insert into read_states (user_id, channel_id, last_read_at, mention_count)
    select t.uid, new.channel_id, 'epoch', 1
    from (
      select unnest(new.mentions) as uid
      union
      select mr.user_id from member_roles mr where mr.role_id = any(new.mention_roles)
      union
      select sm.user_id from server_members sm where new.mention_everyone and sm.server_id = new.server_id
    ) t
    where t.uid is distinct from new.author_id
      and exists (select 1 from server_members sm where sm.server_id = new.server_id and sm.user_id = t.uid)
      and (channel_permissions(new.channel_id, t.uid) & perm('VIEW_CHANNEL')) <> 0
    on conflict (user_id, channel_id) do update set mention_count = read_states.mention_count + 1;

    if new.type = 'default' and new.author_id is not null then
      update server_members sm
         set xp = sm.xp + 15 + floor(random() * 11)::int, last_xp_at = now()
        from servers s
       where s.id = new.server_id and s.xp_enabled
         and sm.server_id = new.server_id and sm.user_id = new.author_id
         and (sm.last_xp_at is null or sm.last_xp_at < now() - interval '60 seconds');
    end if;
  end if;
  return null;
end $$;

drop trigger if exists messages_after_insert on public.messages;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.messages_after_insert();

create or replace function public.messages_before_update() returns trigger
language plpgsql set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_perms bigint;
  v_limit int;
begin
  -- trusted functions and ON DELETE SET NULL cascades skip the browser rules
  if current_user <> 'authenticated' or v_uid is null then return new; end if;
  new.id := old.id;
  new.channel_id := old.channel_id;
  new.server_id := old.server_id;
  new.author_id := old.author_id;
  new.type := old.type;
  new.created_at := old.created_at;
  new.poll := old.poll;
  new.forwarded := old.forwarded;
  new.sticker := old.sticker;
  new.effect := old.effect;
  new.reply_to_id := old.reply_to_id;
  new.nonce := old.nonce;

  if new.content is distinct from old.content or new.attachments is distinct from old.attachments then
    if old.author_id is distinct from v_uid then
      raise exception 'You can only edit your own messages' using errcode = '42501';
    end if;
    if jsonb_array_length(new.attachments) > jsonb_array_length(old.attachments) then
      new.attachments := old.attachments;   -- attachments can be removed while editing, not added
    end if;
    v_limit := case when neon_tier(v_uid) = 'neon' then 4000 else 2000 end;
    if char_length(new.content) > v_limit then
      raise exception 'Messages can be up to % characters', v_limit using errcode = 'P0001';
    end if;
    if btrim(new.content) = '' and jsonb_array_length(new.attachments) = 0 and old.poll is null and old.sticker is null and old.forwarded is null then
      raise exception 'Message is empty — delete it instead' using errcode = 'P0001';
    end if;
    if new.content is distinct from old.content then
      new.edited_at := now();
      new.mentions := extract_mentions(new.content, 'user');
      v_perms := my_channel_perms(old.channel_id);
      new.mention_everyone := old.server_id is not null and new.content ~ '@(everyone|here)'
                              and (v_perms & perm('MENTION_EVERYONE')) <> 0;
      new.mention_roles := coalesce(array(
        select r.id from roles r
        where r.id = any(extract_mentions(new.content, 'role'))
          and r.server_id = old.server_id and not r.is_default
          and (r.mentionable or (v_perms & perm('MENTION_EVERYONE')) <> 0)), '{}');
    end if;
  else
    new.edited_at := old.edited_at;
    new.mentions := old.mentions;
    new.mention_roles := old.mention_roles;
    new.mention_everyone := old.mention_everyone;
  end if;

  if new.embeds is distinct from old.embeds and old.author_id is distinct from v_uid then
    raise exception 'Only the author can change embeds' using errcode = '42501';
  end if;

  if new.flags <> old.flags then
    if old.author_id is distinct from v_uid then
      new.flags := old.flags;
    else
      new.flags := (old.flags & ~2) | (new.flags & 2);   -- authors may only toggle "hide embeds"
    end if;
  end if;

  if new.pinned <> old.pinned then
    if not ((old.server_id is null and is_recipient(old.channel_id))
            or (old.server_id is not null and has_channel_perm(old.channel_id, perm('MANAGE_MESSAGES')))) then
      raise exception 'You need Manage Messages to pin messages' using errcode = '42501';
    end if;
    new.pinned_at := case when new.pinned then now() else null end;
  else
    new.pinned_at := old.pinned_at;
  end if;

  if new.thread_id is distinct from old.thread_id then
    if old.thread_id is not null or not exists (select 1 from channels where id = new.thread_id and starter_message_id = old.id) then
      new.thread_id := old.thread_id;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists messages_before_update on public.messages;
create trigger messages_before_update before update on public.messages
  for each row execute function public.messages_before_update();

create or replace function public.messages_after_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.pinned and not old.pinned and new.type = 'default' then
    insert into messages (channel_id, author_id, type, content, reply_to_id)
    values (new.channel_id, coalesce(auth.uid(), new.author_id), 'pin', '', new.id);
  end if;
  return null;
end $$;

drop trigger if exists messages_after_update on public.messages;
create trigger messages_after_update after update on public.messages
  for each row execute function public.messages_after_update();

create or replace function public.messages_after_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- only direct deletes by someone else (not cascades from deleting a channel/server, not ban clean-ups)
  if old.server_id is not null and auth.uid() is not null and auth.uid() is distinct from old.author_id
     and pg_trigger_depth() = 1 and coalesce(current_setting('cityline.skip_audit', true), '') <> 'on'
     and exists (select 1 from servers where id = old.server_id) then
    insert into audit_log (server_id, actor_id, action, target_type, target_id, changes)
    values (old.server_id, auth.uid(), 'message_delete', 'member', old.author_id::text,
            jsonb_build_object('channel_id', old.channel_id, 'content', left(old.content, 200)));
  end if;
  return null;
end $$;

drop trigger if exists messages_after_delete on public.messages;
create trigger messages_after_delete after delete on public.messages
  for each row execute function public.messages_after_delete();

-- Reactions & poll votes: channel_id always comes from the message.
create or replace function public.reactions_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_channel uuid;
begin
  select channel_id into v_channel from messages where id = new.message_id;
  if v_channel is null then raise exception 'Unknown message' using errcode = 'P0001'; end if;
  new.channel_id := v_channel;
  new.created_at := now();
  if not exists (select 1 from reactions where message_id = new.message_id and emoji = new.emoji)
     and (channel_permissions(v_channel, new.user_id) & perm('ADD_REACTIONS')) = 0 then
    raise exception 'You cannot add new reactions here' using errcode = '42501';
  end if;
  if (select count(distinct emoji) from reactions where message_id = new.message_id) >= 20
     and not exists (select 1 from reactions where message_id = new.message_id and emoji = new.emoji) then
    raise exception 'This message already has 20 different reactions' using errcode = 'P0001';
  end if;
  if new.is_super and neon_tier(new.user_id) is null then
    raise exception 'Super Reactions are a Neon perk' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists reactions_before_insert on public.reactions;
create trigger reactions_before_insert before insert on public.reactions
  for each row execute function public.reactions_before_insert();

create or replace function public.poll_votes_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare m record;
begin
  select channel_id, poll into m from messages where id = new.message_id;
  if m.poll is null then raise exception 'That message has no poll' using errcode = 'P0001'; end if;
  new.channel_id := m.channel_id;
  return new;
end $$;

drop trigger if exists poll_votes_before_insert on public.poll_votes;
create trigger poll_votes_before_insert before insert on public.poll_votes
  for each row execute function public.poll_votes_before_insert();

-- Expressions: emoji slots grow with boost level.
create or replace function public.emojis_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_max int;
begin
  v_max := case boost_level(new.server_id) when 3 then 250 when 2 then 150 when 1 then 100 else 50 end;
  if (select count(*) from emojis where server_id = new.server_id) >= v_max then
    raise exception 'This server has used all % emoji slots — boost it for more', v_max using errcode = 'P0001';
  end if;
  if new.animated and boost_level(new.server_id) < 1 and neon_tier(auth.uid()) is null then
    raise exception 'Animated emoji need Boost Level 1 or Neon' using errcode = 'P0001';
  end if;
  new.created_by := coalesce(auth.uid(), new.created_by);
  return new;
end $$;

drop trigger if exists emojis_before_insert on public.emojis;
create trigger emojis_before_insert before insert on public.emojis
  for each row execute function public.emojis_before_insert();

create or replace function public.set_created_by() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    if tg_table_name = 'server_events' then new.creator_id := auth.uid();
    elsif tg_table_name = 'invites' then new.inviter_id := auth.uid();
    else new.created_by := auth.uid();
    end if;
  end if;
  return new;
end $$;

drop trigger if exists stickers_set_created_by on public.stickers;
create trigger stickers_set_created_by before insert on public.stickers
  for each row execute function public.set_created_by();
drop trigger if exists sounds_set_created_by on public.soundboard_sounds;
create trigger sounds_set_created_by before insert on public.soundboard_sounds
  for each row execute function public.set_created_by();
drop trigger if exists events_set_created_by on public.server_events;
create trigger events_set_created_by before insert on public.server_events
  for each row execute function public.set_created_by();
drop trigger if exists invites_set_created_by on public.invites;
create trigger invites_set_created_by before insert on public.invites
  for each row execute function public.set_created_by();

create or replace function public.event_rsvps_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select server_id into new.server_id from server_events where id = new.event_id;
  return new;
end $$;

drop trigger if exists event_rsvps_before_insert on public.event_rsvps;
create trigger event_rsvps_before_insert before insert on public.event_rsvps
  for each row execute function public.event_rsvps_before_insert();

-- Welcome message when someone joins.
create or replace function public.server_members_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_channel uuid;
begin
  select system_channel_id into v_channel from servers where id = new.server_id;
  if v_channel is not null and not exists (select 1 from servers where id = new.server_id and owner_id = new.user_id) then
    insert into messages (channel_id, author_id, type, content) values (v_channel, new.user_id, 'join', '');
  end if;
  return null;
end $$;

drop trigger if exists server_members_after_insert on public.server_members;
create trigger server_members_after_insert after insert on public.server_members
  for each row execute function public.server_members_after_insert();

-- Audit log for structural changes.
create or replace function public.audit_changes() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_server uuid;
  v_target text;
  v_changes jsonb := '{}'::jsonb;
  v_old jsonb;
  v_new jsonb;
  k text;
begin
  if auth.uid() is null or coalesce(current_setting('cityline.skip_audit', true), '') = 'on' then return null; end if;
  v_old := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end;
  v_new := case when tg_op in ('UPDATE','INSERT') then to_jsonb(new) else null end;
  v_server := coalesce((v_new->>'server_id')::uuid, (v_old->>'server_id')::uuid);
  if tg_table_name = 'servers' then v_server := coalesce((v_new->>'id')::uuid, (v_old->>'id')::uuid); end if;
  if tg_table_name = 'permission_overwrites' then
    select server_id into v_server from channels where id = coalesce((v_new->>'channel_id')::uuid, (v_old->>'channel_id')::uuid);
  end if;
  if v_server is null then return null; end if;
  if tg_table_name = 'channels' and coalesce(v_new->>'type', v_old->>'type') in ('dm','group_dm') then return null; end if;
  if tg_table_name = 'servers' and tg_op = 'DELETE' then return null; end if;
  if not exists (select 1 from servers where id = v_server) then return null; end if;
  v_target := coalesce(v_new->>'id', v_old->>'id', v_new->>'code', v_old->>'code', v_new->>'channel_id', v_old->>'channel_id');
  if tg_table_name = 'member_roles' then v_target := coalesce(v_new->>'user_id', v_old->>'user_id'); end if;
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(v_new) loop
      if k not in ('last_message_at', 'message_count', 'updated_at') and (v_new->k) is distinct from (v_old->k) then
        v_changes := v_changes || jsonb_build_object(k, jsonb_build_object('old', v_old->k, 'new', v_new->k));
      end if;
    end loop;
    if v_changes = '{}'::jsonb then return null; end if;
  elsif tg_op = 'INSERT' then
    v_changes := v_new;
  else
    v_changes := v_old;
  end if;
  insert into audit_log (server_id, actor_id, action, target_type, target_id, changes)
  values (v_server, auth.uid(), lower(tg_table_name || '_' || tg_op), tg_table_name, v_target, v_changes);
  return null;
end $$;

drop trigger if exists audit_servers on public.servers;
create trigger audit_servers after update on public.servers for each row execute function public.audit_changes();
drop trigger if exists audit_channels on public.channels;
create trigger audit_channels after insert or update or delete on public.channels for each row execute function public.audit_changes();
drop trigger if exists audit_roles on public.roles;
create trigger audit_roles after insert or update or delete on public.roles for each row execute function public.audit_changes();
drop trigger if exists audit_member_roles on public.member_roles;
create trigger audit_member_roles after insert or delete on public.member_roles for each row execute function public.audit_changes();
drop trigger if exists audit_invites on public.invites;
create trigger audit_invites after insert or delete on public.invites for each row execute function public.audit_changes();
drop trigger if exists audit_emojis on public.emojis;
create trigger audit_emojis after insert or delete on public.emojis for each row execute function public.audit_changes();
drop trigger if exists audit_overwrites on public.permission_overwrites;
create trigger audit_overwrites after insert or update or delete on public.permission_overwrites for each row execute function public.audit_changes();

-- -----------------------------------------------------------------------------
-- 5. Server functions (RPCs) — called from the browser with supabase.rpc()
-- -----------------------------------------------------------------------------

create or replace function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = public as $$
  select lower(btrim(p_username)) ~ '^[a-z0-9_.]{2,32}$'
     and not exists (select 1 from profiles where username = lower(btrim(p_username)))
$$;

-- Everything the app needs on start-up, in one round trip.
create or replace function public.get_bootstrap() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_servers uuid[];
  v_channels jsonb;
  v_channel_ids uuid[];
  v_dms jsonb;
  v_dm_ids uuid[];
begin
  if v_uid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  select coalesce(array_agg(server_id), '{}') into v_servers from server_members where user_id = v_uid;

  with c as (
    select ch.*, channel_permissions(ch.id, v_uid) as my_perms
    from channels ch
    where ch.server_id = any(v_servers)
      and (ch.type <> 'thread' or (not ch.archived and coalesce(ch.last_message_at, ch.created_at) > now() - interval '14 days'))
  )
  select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb), coalesce(array_agg(c.id), '{}')
    into v_channels, v_channel_ids
  from c where (c.my_perms & perm('VIEW_CHANNEL')) <> 0;

  select coalesce(jsonb_agg(to_jsonb(ch) || jsonb_build_object(
           'my_perms', perm('DM'),
           'closed', cr.closed,
           'recipients', (select jsonb_agg(r.user_id) from channel_recipients r where r.channel_id = ch.id))), '[]'::jsonb),
         coalesce(array_agg(ch.id), '{}')
    into v_dms, v_dm_ids
  from channels ch join channel_recipients cr on cr.channel_id = ch.id and cr.user_id = v_uid;

  return jsonb_build_object(
    'me', (select profile_json(p) from profiles p where p.id = v_uid),
    'neon', (select to_jsonb(n) from neon_subscriptions n where n.user_id = v_uid),
    'settings', coalesce((select settings from user_settings where user_id = v_uid), '{}'::jsonb),
    'servers', coalesce((
      select jsonb_agg(to_jsonb(s) || jsonb_build_object(
        'boost_count', server_boost_count(s.id),
        'member_count', (select count(*) from server_members m where m.server_id = s.id),
        'my_perms', server_permissions(s.id, v_uid)))
      from servers s where s.id = any(v_servers)), '[]'::jsonb),
    'memberships', coalesce((select jsonb_agg(member_json(sm)) from server_members sm where sm.user_id = v_uid), '[]'::jsonb),
    'roles', coalesce((select jsonb_agg(to_jsonb(r) order by r.position desc) from roles r where r.server_id = any(v_servers)), '[]'::jsonb),
    'channels', v_channels,
    'dm_channels', v_dms,
    'overwrites', coalesce((select jsonb_agg(to_jsonb(o)) from permission_overwrites o where o.channel_id = any(v_channel_ids)), '[]'::jsonb),
    'read_states', coalesce((select jsonb_agg(to_jsonb(rs)) from read_states rs
                              where rs.user_id = v_uid and (rs.channel_id = any(v_channel_ids) or rs.channel_id = any(v_dm_ids))), '[]'::jsonb),
    'relationships', coalesce((select jsonb_agg(to_jsonb(r)) from relationships r where r.user_id = v_uid), '[]'::jsonb),
    'profiles', coalesce((
      select jsonb_agg(profile_json(p)) from profiles p
      where p.id in (select cr.user_id from channel_recipients cr where cr.channel_id = any(v_dm_ids)
                     union select r.target_id from relationships r where r.user_id = v_uid)), '[]'::jsonb),
    'emojis', coalesce((select jsonb_agg(to_jsonb(e) order by e.name) from emojis e where e.server_id = any(v_servers)), '[]'::jsonb),
    'stickers', coalesce((select jsonb_agg(to_jsonb(s)) from stickers s where s.server_id = any(v_servers)), '[]'::jsonb),
    'sounds', coalesce((select jsonb_agg(to_jsonb(s)) from soundboard_sounds s where s.server_id = any(v_servers)), '[]'::jsonb),
    'notification_settings', coalesce((select jsonb_agg(to_jsonb(n)) from notification_settings n where n.user_id = v_uid), '[]'::jsonb),
    'my_boosts', coalesce((select jsonb_agg(to_jsonb(b)) from boosts b where b.user_id = v_uid), '[]'::jsonb)
  );
end $$;

create or replace function public.get_server_members(p_server uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_member(p_server) then raise exception 'You are not in this server' using errcode = '42501'; end if;
  return jsonb_build_object(
    'members', coalesce((select jsonb_agg(member_json(sm)) from server_members sm where sm.server_id = p_server), '[]'::jsonb),
    'profiles', coalesce((select jsonb_agg(profile_json(p)) from profiles p
                          where p.id in (select user_id from server_members where server_id = p_server)), '[]'::jsonb));
end $$;

create or replace function public.get_profiles(p_ids uuid[]) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(profile_json(p)), '[]'::jsonb) from profiles p where p.id = any(p_ids)
$$;

-- Full profile card: mutual servers and friends.
create or replace function public.get_user_profile(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  return jsonb_build_object(
    'profile', (select profile_json(p) from profiles p where p.id = p_user),
    'neon_since', (select started_at from neon_subscriptions where user_id = p_user and expires_at > now()),
    'mutual_servers', coalesce((select jsonb_agg(a.server_id) from server_members a
                                join server_members b on b.server_id = a.server_id and b.user_id = v_uid
                                where a.user_id = p_user), '[]'::jsonb),
    'mutual_friends', coalesce((select jsonb_agg(a.target_id) from relationships a
                                join relationships b on b.target_id = a.target_id and b.user_id = v_uid and b.type = 'friend'
                                where a.user_id = p_user and a.type = 'friend'), '[]'::jsonb),
    'relationship', (select type from relationships where user_id = v_uid and target_id = p_user)
  );
end $$;

create or replace function public.get_messages(
  p_channel uuid, p_before timestamptz default null, p_after timestamptz default null,
  p_around uuid default null, p_limit int default 50
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_rows public.messages[];
  v_at timestamptz;
  v_lim int := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if not can_read_channel(p_channel) then
    raise exception 'You cannot read this channel' using errcode = '42501';
  end if;
  if p_around is not null then
    select created_at into v_at from messages where id = p_around and channel_id = p_channel;
    if v_at is null then v_at := now(); end if;
    v_rows := array(select m from messages m where m.channel_id = p_channel and m.created_at < v_at
                    order by m.created_at desc limit v_lim / 2)
           || array(select m from messages m where m.channel_id = p_channel and m.created_at >= v_at
                    order by m.created_at asc limit v_lim / 2);
  elsif p_after is not null then
    v_rows := array(select m from messages m where m.channel_id = p_channel and m.created_at > p_after
                    order by m.created_at asc limit v_lim);
  else
    v_rows := array(select m from messages m where m.channel_id = p_channel and (p_before is null or m.created_at < p_before)
                    order by m.created_at desc limit v_lim);
  end if;
  return jsonb_build_object(
    'messages', coalesce((select jsonb_agg(message_json(m, v_uid) order by m.created_at) from unnest(v_rows) m), '[]'::jsonb),
    'profiles', coalesce((select jsonb_agg(profile_json(p)) from profiles p
                          where p.id in (select m.author_id from unnest(v_rows) m
                                         union select r.author_id from messages r where r.id in (select m.reply_to_id from unnest(v_rows) m))), '[]'::jsonb),
    'has_more', coalesce(array_length(v_rows, 1), 0) >= v_lim
  );
end $$;

create or replace function public.get_message(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare m public.messages;
begin
  select * into m from messages where id = p_id;
  if not found or not can_read_channel(m.channel_id) then return null; end if;
  return message_json(m, auth.uid());
end $$;

create or replace function public.get_pins(p_channel uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not can_read_channel(p_channel) then raise exception 'You cannot read this channel' using errcode = '42501'; end if;
  return jsonb_build_object(
    'messages', coalesce((select jsonb_agg(message_json(m, auth.uid()) order by m.pinned_at desc) from messages m where m.channel_id = p_channel and m.pinned), '[]'::jsonb),
    'profiles', coalesce((select jsonb_agg(profile_json(p)) from profiles p where p.id in (select author_id from messages where channel_id = p_channel and pinned)), '[]'::jsonb));
end $$;

create or replace function public.search_messages(
  p_query text default '', p_server uuid default null, p_channel uuid default null,
  p_author uuid default null, p_has text default null, p_mentions uuid default null,
  p_before timestamptz default null, p_after timestamptz default null,
  p_pinned boolean default null, p_limit int default 25, p_offset int default 0
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_channels uuid[];
  v_total int;
  v_rows public.messages[];
  v_q text := btrim(coalesce(p_query, ''));
begin
  if p_channel is not null then
    if not can_read_channel(p_channel) then raise exception 'You cannot read this channel' using errcode = '42501'; end if;
    v_channels := array[p_channel];
  elsif p_server is not null then
    if not is_member(p_server) then raise exception 'You are not in this server' using errcode = '42501'; end if;
    select coalesce(array_agg(id), '{}') into v_channels from channels
    where server_id = p_server and type not in ('category')
      and (channel_permissions(id, v_uid) & (perm('VIEW_CHANNEL') | perm('READ_HISTORY'))) = (perm('VIEW_CHANNEL') | perm('READ_HISTORY'));
  else
    select coalesce(array_agg(channel_id), '{}') into v_channels from channel_recipients where user_id = v_uid;
  end if;

  with hits as (
    select m as msg, m.created_at from messages m
    where m.channel_id = any(v_channels) and m.type = 'default'
      and (v_q = '' or m.content ilike '%' || replace(replace(v_q, '%', '\%'), '_', '\_') || '%')
      and (p_author is null or m.author_id = p_author)
      and (p_mentions is null or p_mentions = any(m.mentions))
      and (p_before is null or m.created_at < p_before)
      and (p_after is null or m.created_at > p_after)
      and (p_pinned is null or m.pinned = p_pinned)
      and (p_has is null
        or (p_has = 'link' and m.content ~* 'https?://')
        or (p_has = 'file' and jsonb_array_length(m.attachments) > 0)
        or (p_has = 'image' and exists (select 1 from jsonb_array_elements(m.attachments) a where a->>'type' like 'image/%'))
        or (p_has = 'video' and exists (select 1 from jsonb_array_elements(m.attachments) a where a->>'type' like 'video/%'))
        or (p_has = 'sound' and exists (select 1 from jsonb_array_elements(m.attachments) a where a->>'type' like 'audio/%'))
        or (p_has = 'poll' and m.poll is not null)
        or (p_has = 'embed' and jsonb_array_length(m.embeds) > 0))
  )
  select (select count(*) from hits),
         array(select h.msg from hits h order by h.created_at desc limit least(coalesce(p_limit, 25), 50) offset greatest(coalesce(p_offset, 0), 0))
    into v_total, v_rows;

  return jsonb_build_object(
    'total', v_total,
    'messages', coalesce((select jsonb_agg(message_json(m, v_uid) order by m.created_at desc) from unnest(v_rows) m), '[]'::jsonb),
    'profiles', coalesce((select jsonb_agg(profile_json(p)) from profiles p where p.id in (select m.author_id from unnest(v_rows) m)), '[]'::jsonb));
end $$;

-- Inbox: recent messages that mention you.
create or replace function public.get_mentions(p_limit int default 30, p_before timestamptz default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_rows public.messages[];
begin
  v_rows := array(
    select m from messages m
    where m.created_at > now() - interval '30 days'
      and (p_before is null or m.created_at < p_before)
      and m.author_id is distinct from v_uid
      and m.type = 'default'
      and (v_uid = any(m.mentions)
           or (m.mention_everyone and m.server_id in (select server_id from server_members where user_id = v_uid))
           or m.mention_roles && coalesce((select array_agg(role_id) from member_roles where user_id = v_uid), '{}'))
      and can_read_channel(m.channel_id)
    order by m.created_at desc
    limit least(coalesce(p_limit, 30), 100));
  return jsonb_build_object(
    'messages', coalesce((select jsonb_agg(message_json(m, v_uid) order by m.created_at desc) from unnest(v_rows) m), '[]'::jsonb),
    'profiles', coalesce((select jsonb_agg(profile_json(p)) from profiles p where p.id in (select m.author_id from unnest(v_rows) m)), '[]'::jsonb));
end $$;

-- NEW: "Catch Up" — the most talked-about messages you missed in a server.
create or replace function public.get_catch_up(p_server uuid, p_limit int default 12) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_rows jsonb;
begin
  if not is_member(p_server) then raise exception 'You are not in this server' using errcode = '42501'; end if;
  with readable as (
    select c.id, greatest(coalesce(rs.last_read_at, 'epoch'), now() - interval '3 days') as since
    from channels c
    left join read_states rs on rs.channel_id = c.id and rs.user_id = v_uid
    where c.server_id = p_server and c.type in ('text','announcement','thread','voice')
      and c.last_message_at > greatest(coalesce(rs.last_read_at, 'epoch'), now() - interval '3 days')
      and (channel_permissions(c.id, v_uid) & (perm('VIEW_CHANNEL') | perm('READ_HISTORY'))) = (perm('VIEW_CHANNEL') | perm('READ_HISTORY'))
  ), scored as (
    select m as msg, m.created_at, m.author_id,
      (select count(*) from reactions r where r.message_id = m.id) * 3
      + (select count(*) from messages rp where rp.reply_to_id = m.id) * 4
      + case when v_uid = any(m.mentions) then 25 else 0 end
      + case when m.mention_everyone then 10 else 0 end
      + case when m.pinned then 15 else 0 end
      + least(char_length(m.content) / 80, 4)
      + case when jsonb_array_length(m.attachments) > 0 then 2 else 0 end
      + case when m.poll is not null then 6 else 0 end as score
    from messages m join readable rd on rd.id = m.channel_id
    where m.created_at > rd.since and m.type = 'default' and m.author_id is distinct from v_uid
  )
  select jsonb_build_object(
    'messages', coalesce((select jsonb_agg(message_json(s.msg, v_uid) || jsonb_build_object('score', s.score) order by s.score desc, s.created_at desc)
                          from (select * from scored order by score desc, created_at desc limit least(p_limit, 30)) s), '[]'::jsonb),
    'unread_messages', (select count(*) from scored),
    'channels', (select count(*) from readable),
    'profiles', coalesce((select jsonb_agg(profile_json(p)) from profiles p where p.id in (select author_id from scored)), '[]'::jsonb))
  into v_rows;
  return v_rows;
end $$;

create or replace function public.mark_read(p_channel uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not can_view_channel(p_channel) then return; end if;
  insert into read_states (user_id, channel_id, last_read_at, mention_count)
  values (auth.uid(), p_channel, now(), 0)
  on conflict (user_id, channel_id) do update set last_read_at = now(), mention_count = 0;
end $$;

create or replace function public.mark_server_read(p_server uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into read_states (user_id, channel_id, last_read_at, mention_count)
  select auth.uid(), c.id, now(), 0 from channels c
  where c.server_id = p_server and c.type <> 'category' and can_view_channel(c.id)
  on conflict (user_id, channel_id) do update set last_read_at = now(), mention_count = 0;
end $$;

-- ---------- Servers --------------------------------------------------------

create or replace function public.create_server(p_name text, p_icon_url text default null, p_template text default 'default')
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_server uuid;
  v_text_cat uuid;
  v_voice_cat uuid;
  v_info_cat uuid;
  v_general uuid;
  v_everyone uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_count int;
begin
  if v_uid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  if char_length(v_name) < 2 then raise exception 'Server names need at least 2 characters' using errcode = 'P0001'; end if;
  select count(*) into v_count from server_members where user_id = v_uid;
  if v_count >= (case when neon_tier(v_uid) = 'neon' then 200 else 100 end) then
    raise exception 'You have joined the maximum number of servers' using errcode = 'P0001';
  end if;

  perform set_config('cityline.skip_audit', 'on', true);
  insert into servers (name, icon_url, owner_id) values (left(v_name, 100), p_icon_url, v_uid) returning id into v_server;
  insert into roles (server_id, name, position, permissions, is_default)
    values (v_server, '@everyone', 0, perm('DEFAULT'), true) returning id into v_everyone;
  insert into server_members (server_id, user_id) values (v_server, v_uid);

  if p_template in ('gaming', 'community', 'creators', 'study') then
    insert into channels (server_id, type, name, position) values (v_server, 'category', 'Information', 0) returning id into v_info_cat;
  end if;
  insert into channels (server_id, type, name, position) values (v_server, 'category', 'Text Channels', 1) returning id into v_text_cat;
  insert into channels (server_id, type, name, position) values (v_server, 'category', 'Voice Channels', 2) returning id into v_voice_cat;

  case coalesce(p_template, 'default')
    when 'gaming' then
      insert into channels (server_id, type, name, position, parent_id, topic) values
        (v_server, 'announcement', 'announcements', 0, v_info_cat, 'Patch notes, tournaments and server news'),
        (v_server, 'text', 'rules', 1, v_info_cat, 'Read these before you play');
      insert into channels (server_id, type, name, position, parent_id, topic) values
        (v_server, 'text', 'general', 0, v_text_cat, 'Talk about anything') returning id into v_general;
      insert into channels (server_id, type, name, position, parent_id, topic) values
        (v_server, 'text', 'clips-and-highlights', 1, v_text_cat, 'Show off your best plays'),
        (v_server, 'text', 'looking-for-group', 2, v_text_cat, 'Find a squad');
      insert into channels (server_id, type, name, position, parent_id) values
        (v_server, 'voice', 'Lobby', 0, v_voice_cat), (v_server, 'voice', 'Squad Up', 1, v_voice_cat), (v_server, 'voice', 'Stream Room', 2, v_voice_cat);
    when 'friends' then
      insert into channels (server_id, type, name, position, parent_id, topic) values
        (v_server, 'text', 'general', 0, v_text_cat, 'The group chat') returning id into v_general;
      insert into channels (server_id, type, name, position, parent_id, topic) values
        (v_server, 'text', 'memes', 1, v_text_cat, 'Peak comedy only'),
        (v_server, 'text', 'plans', 2, v_text_cat, 'When are we hanging out?');
      insert into channels (server_id, type, name, position, parent_id) values
        (v_server, 'voice', 'Lounge', 0, v_voice_cat), (v_server, 'voice', 'Movie Night', 1, v_voice_cat);
    when 'study' then
      insert into channels (server_id, type, name, position, parent_id, topic) values
        (v_server, 'text', 'welcome-and-rules', 0, v_info_cat, 'Start here'),
        (v_server, 'text', 'resources', 1, v_info_cat, 'Notes, links and guides');
      insert into channels (server_id, type, name, position, parent_id, topic) values
        (v_server, 'text', 'general', 0, v_text_cat, 'Chat between sessions') returning id into v_general;
      insert into channels (server_id, type, name, position, parent_id, topic) values
        (v_server, 'forum', 'homework-help', 1, v_text_cat, 'Ask a question — one post per problem'),
        (v_server, 'text', 'session-planning', 2, v_text_cat, 'Plan study sessions');
      insert into channels (server_id, type, name, position, parent_id) values
        (v_server, 'voice', 'Study Room 1', 0, v_voice_cat), (v_server, 'voice', 'Study Room 2', 1, v_voice_cat);
    when 'creators' then
      insert into channels (server_id, type, name, position, parent_id, topic) values
        (v_server, 'announcement', 'announcements', 0, v_info_cat, 'New drops and news'),
        (v_server, 'text', 'rules', 1, v_info_cat, 'Be kind, give credit');
      insert into channels (server_id, type, name, position, parent_id, topic) values
        (v_server, 'text', 'general', 0, v_text_cat, 'Hang out with the community') returning id into v_general;
      insert into channels (server_id, type, name, position, parent_id, topic) values
        (v_server, 'forum', 'showcase', 1, v_text_cat, 'Share what you made'),
        (v_server, 'text', 'feedback', 2, v_text_cat, 'Ideas and suggestions');
      insert into channels (server_id, type, name, position, parent_id) values
        (v_server, 'voice', 'Lounge', 0, v_voice_cat), (v_server, 'stage', 'Live Q&A', 1, v_voice_cat);
    when 'community' then
      insert into channels (server_id, type, name, position, parent_id, topic) values
        (v_server, 'text', 'welcome', 0, v_info_cat, 'Say hi!'),
        (v_server, 'announcement', 'announcements', 1, v_info_cat, 'Server news'),
        (v_server, 'text', 'rules', 2, v_info_cat, 'The ground rules');
      insert into channels (server_id, type, name, position, parent_id, topic) values
        (v_server, 'text', 'general', 0, v_text_cat, 'Main chat') returning id into v_general;
      insert into channels (server_id, type, name, position, parent_id, topic) values
        (v_server, 'text', 'introductions', 1, v_text_cat, 'Tell us about yourself'),
        (v_server, 'text', 'off-topic', 2, v_text_cat, 'Anything goes'),
        (v_server, 'forum', 'ideas', 3, v_text_cat, 'Suggest something for the server');
      insert into channels (server_id, type, name, position, parent_id) values
        (v_server, 'voice', 'General', 0, v_voice_cat), (v_server, 'stage', 'Events', 1, v_voice_cat);
    else
      insert into channels (server_id, type, name, position, parent_id, topic) values
        (v_server, 'text', 'general', 0, v_text_cat, '') returning id into v_general;
      insert into channels (server_id, type, name, position, parent_id) values
        (v_server, 'voice', 'General', 0, v_voice_cat);
  end case;

  update servers set system_channel_id = v_general where id = v_server;
  perform set_config('cityline.skip_audit', 'off', true);
  return v_server;
end $$;

create or replace function public.get_invite(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'code', i.code,
    'expires_at', i.expires_at,
    'server', jsonb_build_object('id', s.id, 'name', s.name, 'icon_url', s.icon_url, 'banner_url', s.banner_url,
                                 'description', s.description, 'accent_color', s.accent_color,
                                 'member_count', (select count(*) from server_members m where m.server_id = s.id),
                                 'boost_count', server_boost_count(s.id)),
    'channel', (select jsonb_build_object('id', c.id, 'name', c.name, 'type', c.type) from channels c where c.id = i.channel_id),
    'inviter', (select jsonb_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url)
                from profiles p where p.id = i.inviter_id),
    'is_member', exists (select 1 from server_members m where m.server_id = s.id and m.user_id = auth.uid())
  )
  from invites i join servers s on s.id = i.server_id
  where i.code = btrim(p_code)
    and (i.expires_at is null or i.expires_at > now())
    and (i.max_uses = 0 or i.uses < i.max_uses)
$$;

create or replace function public.join_server(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  inv public.invites;
begin
  if v_uid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  select * into inv from invites where code = btrim(p_code) for update;
  if not found or (inv.expires_at is not null and inv.expires_at <= now()) or (inv.max_uses > 0 and inv.uses >= inv.max_uses) then
    raise exception 'This invite is invalid or has expired' using errcode = 'P0001';
  end if;
  if exists (select 1 from bans where server_id = inv.server_id and user_id = v_uid) then
    raise exception 'You are banned from this server' using errcode = '42501';
  end if;
  if exists (select 1 from server_members where server_id = inv.server_id and user_id = v_uid) then
    return inv.server_id;
  end if;
  insert into server_members (server_id, user_id) values (inv.server_id, v_uid);
  update invites set uses = uses + 1 where code = inv.code;
  return inv.server_id;
end $$;

create or replace function public.discover_servers(p_query text default '', p_tag text default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by (x->>'member_count')::int desc), '[]'::jsonb) from (
    select jsonb_build_object('id', s.id, 'name', s.name, 'description', s.description, 'icon_url', s.icon_url,
             'banner_url', s.banner_url, 'tags', s.tags, 'accent_color', s.accent_color,
             'member_count', (select count(*) from server_members m where m.server_id = s.id),
             'boost_count', server_boost_count(s.id),
             'is_member', exists (select 1 from server_members m where m.server_id = s.id and m.user_id = auth.uid())) as x
    from servers s
    where s.is_public
      and (coalesce(p_query, '') = '' or s.name ilike '%' || p_query || '%' or s.description ilike '%' || p_query || '%')
      and (p_tag is null or p_tag = any(s.tags))
    limit 60
  ) t
$$;

create or replace function public.join_public_server(p_server uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  if not exists (select 1 from servers where id = p_server and is_public) then
    raise exception 'That server is not public' using errcode = 'P0001';
  end if;
  if exists (select 1 from bans where server_id = p_server and user_id = v_uid) then
    raise exception 'You are banned from this server' using errcode = '42501';
  end if;
  insert into server_members (server_id, user_id) values (p_server, v_uid) on conflict do nothing;
  return p_server;
end $$;

create or replace function public.leave_server(p_server uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from servers where id = p_server and owner_id = auth.uid()) then
    raise exception 'Transfer ownership or delete the server before leaving' using errcode = 'P0001';
  end if;
  delete from server_members where server_id = p_server and user_id = auth.uid();
  delete from boosts where server_id = p_server and user_id = auth.uid();
end $$;

create or replace function public.kick_member(p_server uuid, p_user uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_server_perm(p_server, perm('KICK_MEMBERS')) or not outranks(p_server, auth.uid(), p_user) then
    raise exception 'You cannot kick this member' using errcode = '42501';
  end if;
  delete from server_members where server_id = p_server and user_id = p_user;
  insert into audit_log (server_id, actor_id, action, target_type, target_id, reason)
  values (p_server, auth.uid(), 'member_kick', 'member', p_user::text, p_reason);
end $$;

create or replace function public.ban_member(p_server uuid, p_user uuid, p_reason text default null, p_delete_hours int default 0) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_server_perm(p_server, perm('BAN_MEMBERS')) or not outranks(p_server, auth.uid(), p_user) then
    raise exception 'You cannot ban this member' using errcode = '42501';
  end if;
  insert into bans (server_id, user_id, reason, banned_by) values (p_server, p_user, p_reason, auth.uid())
  on conflict (server_id, user_id) do update set reason = excluded.reason, banned_by = excluded.banned_by, created_at = now();
  delete from server_members where server_id = p_server and user_id = p_user;
  if coalesce(p_delete_hours, 0) > 0 then
    perform set_config('cityline.skip_audit', 'on', true);
    delete from messages where server_id = p_server and author_id = p_user
      and created_at > now() - make_interval(hours => least(p_delete_hours, 168));
    perform set_config('cityline.skip_audit', 'off', true);
  end if;
  insert into audit_log (server_id, actor_id, action, target_type, target_id, reason)
  values (p_server, auth.uid(), 'member_ban', 'member', p_user::text, p_reason);
end $$;

create or replace function public.unban_member(p_server uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_server_perm(p_server, perm('BAN_MEMBERS')) then
    raise exception 'You cannot manage bans' using errcode = '42501';
  end if;
  delete from bans where server_id = p_server and user_id = p_user;
  insert into audit_log (server_id, actor_id, action, target_type, target_id)
  values (p_server, auth.uid(), 'member_unban', 'member', p_user::text);
end $$;

create or replace function public.get_bans(p_server uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_server_perm(p_server, perm('BAN_MEMBERS')) then
    raise exception 'You cannot view bans' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(to_jsonb(b) || jsonb_build_object('profile', (select profile_json(p) from profiles p where p.id = b.user_id)) order by b.created_at desc)
                   from bans b where b.server_id = p_server), '[]'::jsonb);
end $$;

create or replace function public.timeout_member(p_server uuid, p_user uuid, p_minutes int, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_server_perm(p_server, perm('MODERATE_MEMBERS')) or not outranks(p_server, auth.uid(), p_user) then
    raise exception 'You cannot time out this member' using errcode = '42501';
  end if;
  if server_permissions(p_server, p_user) = perm('ALL') then
    raise exception 'Administrators cannot be timed out' using errcode = 'P0001';
  end if;
  update server_members
     set timeout_until = case when coalesce(p_minutes, 0) <= 0 then null else now() + make_interval(mins => least(p_minutes, 40320)) end
   where server_id = p_server and user_id = p_user;
  insert into audit_log (server_id, actor_id, action, target_type, target_id, reason, changes)
  values (p_server, auth.uid(), case when coalesce(p_minutes, 0) <= 0 then 'member_timeout_remove' else 'member_timeout' end,
          'member', p_user::text, p_reason, jsonb_build_object('minutes', p_minutes));
end $$;

create or replace function public.set_nickname(p_server uuid, p_user uuid, p_nickname text) returns void
language plpgsql security definer set search_path = public as $$
declare v_nick text := nullif(btrim(coalesce(p_nickname, '')), '');
begin
  if p_user = auth.uid() then
    if not has_server_perm(p_server, perm('CHANGE_NICKNAME')) then
      raise exception 'You cannot change your nickname here' using errcode = '42501';
    end if;
  elsif not has_server_perm(p_server, perm('MANAGE_NICKNAMES')) or not outranks(p_server, auth.uid(), p_user) then
    raise exception 'You cannot change this nickname' using errcode = '42501';
  end if;
  update server_members set nickname = left(v_nick, 32) where server_id = p_server and user_id = p_user;
end $$;

-- Neon: a different avatar per server.
create or replace function public.set_server_avatar(p_server uuid, p_url text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_url is not null and neon_tier(auth.uid()) is distinct from 'neon' then
    raise exception 'Per-server avatars are a Neon perk' using errcode = 'P0001';
  end if;
  update server_members set avatar_url = p_url where server_id = p_server and user_id = auth.uid();
end $$;

create or replace function public.reorder_channels(p_server uuid, p_items jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare it jsonb;
begin
  if not has_server_perm(p_server, perm('MANAGE_CHANNELS')) then
    raise exception 'You cannot manage channels' using errcode = '42501';
  end if;
  for it in select * from jsonb_array_elements(p_items) loop
    update channels set position = (it->>'position')::int,
                        parent_id = case when it ? 'parent_id' then nullif(it->>'parent_id', '')::uuid else parent_id end
     where id = (it->>'id')::uuid and server_id = p_server and type not in ('thread');
  end loop;
end $$;

create or replace function public.reorder_roles(p_server uuid, p_items jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare it jsonb;
begin
  for it in select * from jsonb_array_elements(p_items) loop
    if not can_manage_role((it->>'id')::uuid) then
      raise exception 'You cannot move one of these roles' using errcode = '42501';
    end if;
    update roles set position = greatest((it->>'position')::int, 1) where id = (it->>'id')::uuid and server_id = p_server and not is_default;
  end loop;
end $$;

create or replace function public.get_audit_log(p_server uuid, p_limit int default 50, p_before bigint default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_server_perm(p_server, perm('VIEW_AUDIT_LOG')) then
    raise exception 'You cannot view the audit log' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'entries', coalesce((select jsonb_agg(to_jsonb(a) order by a.id desc) from (
       select * from audit_log where server_id = p_server and (p_before is null or id < p_before) order by id desc limit least(p_limit, 100)) a), '[]'::jsonb),
    'profiles', coalesce((select jsonb_agg(profile_json(p)) from profiles p where p.id in (
       select actor_id from audit_log where server_id = p_server order by id desc limit 200)), '[]'::jsonb));
end $$;

-- ---------- Threads & forums ----------------------------------------------

create or replace function public.create_thread(
  p_parent uuid, p_name text, p_message uuid default null, p_content text default null,
  p_tags text[] default '{}', p_attachments jsonb default '[]'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_parent record;
  v_thread uuid;
  v_first uuid;
  v_name text := left(btrim(coalesce(p_name, '')), 100);
begin
  select id, server_id, type into v_parent from channels where id = p_parent;
  if not found then raise exception 'Unknown channel' using errcode = 'P0001'; end if;
  if (channel_permissions(p_parent, v_uid) & (perm('VIEW_CHANNEL') | perm('CREATE_THREADS'))) <> (perm('VIEW_CHANNEL') | perm('CREATE_THREADS')) then
    raise exception 'You cannot create threads here' using errcode = '42501';
  end if;
  if v_name = '' then raise exception 'Threads need a name' using errcode = 'P0001'; end if;
  if v_parent.type = 'forum' and coalesce(btrim(p_content), '') = '' and jsonb_array_length(coalesce(p_attachments, '[]'::jsonb)) = 0 then
    raise exception 'Forum posts need a message' using errcode = 'P0001';
  end if;
  if p_message is not null and not exists (select 1 from messages where id = p_message and channel_id = p_parent and thread_id is null) then
    raise exception 'That message already has a thread' using errcode = 'P0001';
  end if;

  insert into channels (server_id, type, name, thread_parent_id, owner_id, starter_message_id, applied_tags)
  values (v_parent.server_id, 'thread', v_name, p_parent, v_uid, p_message, coalesce(p_tags, '{}'))
  returning id into v_thread;

  if p_message is not null then
    update messages set thread_id = v_thread where id = p_message;
    insert into messages (channel_id, author_id, type, content, reply_to_id)
    values (p_parent, v_uid, 'thread', v_name, p_message);
  end if;

  if coalesce(btrim(p_content), '') <> '' or jsonb_array_length(coalesce(p_attachments, '[]'::jsonb)) > 0 then
    insert into messages (channel_id, author_id, content, attachments)
    values (v_thread, v_uid, coalesce(p_content, ''), coalesce(p_attachments, '[]'::jsonb))
    returning id into v_first;
    if v_parent.type = 'forum' then
      update channels set starter_message_id = v_first where id = v_thread;
    end if;
  end if;
  return v_thread;
end $$;

create or replace function public.get_threads(p_parent uuid, p_archived boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if not can_read_channel(p_parent) then raise exception 'You cannot read this channel' using errcode = '42501'; end if;
  return jsonb_build_object(
    'threads', coalesce((
      select jsonb_agg(to_jsonb(t) || jsonb_build_object(
        'starter', (select message_json(m, v_uid) from messages m where m.id = t.starter_message_id),
        'last_read_at', (select rs.last_read_at from read_states rs where rs.channel_id = t.id and rs.user_id = v_uid))
        order by coalesce(t.last_message_at, t.created_at) desc)
      from channels t where t.thread_parent_id = p_parent and (p_archived or not t.archived)), '[]'::jsonb),
    'profiles', coalesce((select jsonb_agg(profile_json(p)) from profiles p where p.id in (
      select t.owner_id from channels t where t.thread_parent_id = p_parent)), '[]'::jsonb));
end $$;

-- ---------- Polls ----------------------------------------------------------

create or replace function public.vote_poll(p_message uuid, p_options text[]) returns void
language plpgsql security definer set search_path = public as $$
declare m record; v_opt text;
begin
  select channel_id, poll into m from messages where id = p_message;
  if m.poll is null or not can_read_channel(m.channel_id) then raise exception 'Poll not found' using errcode = 'P0001'; end if;
  if (m.poll->>'expires_at') is not null and (m.poll->>'expires_at')::timestamptz < now() then
    raise exception 'This poll has ended' using errcode = 'P0001';
  end if;
  if coalesce(array_length(p_options, 1), 0) > 1 and not coalesce((m.poll->>'multi')::boolean, false) then
    raise exception 'Pick just one answer' using errcode = 'P0001';
  end if;
  delete from poll_votes where message_id = p_message and user_id = auth.uid();
  foreach v_opt in array coalesce(p_options, '{}') loop
    if exists (select 1 from jsonb_array_elements(m.poll->'options') o where o->>'id' = v_opt) then
      insert into poll_votes (message_id, user_id, option_id) values (p_message, auth.uid(), v_opt) on conflict do nothing;
    end if;
  end loop;
end $$;

-- ---------- DMs ------------------------------------------------------------

create or replace function public.open_dm(p_user uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_key text;
  v_channel uuid;
begin
  if v_uid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  if p_user = v_uid or not exists (select 1 from profiles where id = p_user) then
    raise exception 'You cannot message that user' using errcode = 'P0001';
  end if;
  v_key := least(v_uid::text, p_user::text) || ':' || greatest(v_uid::text, p_user::text);
  select id into v_channel from channels where dm_key = v_key;
  if v_channel is null then
    if exists (select 1 from relationships where type = 'blocked'
               and ((user_id = v_uid and target_id = p_user) or (user_id = p_user and target_id = v_uid))) then
      raise exception 'You cannot message this user' using errcode = 'P0001';
    end if;
    insert into channels (type, dm_key) values ('dm', v_key) on conflict (dm_key) do nothing returning id into v_channel;
    if v_channel is null then
      select id into v_channel from channels where dm_key = v_key;
    end if;
    insert into channel_recipients (channel_id, user_id) values (v_channel, v_uid), (v_channel, p_user) on conflict do nothing;
  end if;
  update channel_recipients set closed = false where channel_id = v_channel and user_id = v_uid;
  return v_channel;
end $$;

create or replace function public.create_group_dm(p_users uuid[], p_name text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_channel uuid;
  v_others uuid[];
  v_user uuid;
begin
  v_others := array(select distinct u from unnest(p_users) u where u is not null and u <> v_uid);
  if coalesce(array_length(v_others, 1), 0) = 0 then raise exception 'Pick at least one friend' using errcode = 'P0001'; end if;
  if array_length(v_others, 1) = 1 then return open_dm(v_others[1]); end if;
  if array_length(v_others, 1) > 9 then raise exception 'Group DMs hold up to 10 people' using errcode = 'P0001'; end if;
  foreach v_user in array v_others loop
    if not exists (select 1 from relationships where user_id = v_uid and target_id = v_user and type = 'friend') then
      raise exception 'You can only add friends to a group DM' using errcode = 'P0001';
    end if;
  end loop;
  insert into channels (type, name, owner_id) values ('group_dm', left(coalesce(btrim(p_name), ''), 100), v_uid) returning id into v_channel;
  insert into channel_recipients (channel_id, user_id) select v_channel, u from unnest(v_others || v_uid) u;
  return v_channel;
end $$;

create or replace function public.add_group_dm_recipient(p_channel uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if not exists (select 1 from channels where id = p_channel and type = 'group_dm') or not is_recipient(p_channel) then
    raise exception 'Group not found' using errcode = 'P0001';
  end if;
  if not exists (select 1 from relationships where user_id = v_uid and target_id = p_user and type = 'friend') then
    raise exception 'You can only add friends' using errcode = 'P0001';
  end if;
  if (select count(*) from channel_recipients where channel_id = p_channel) >= 10 then
    raise exception 'This group is full' using errcode = 'P0001';
  end if;
  insert into channel_recipients (channel_id, user_id) values (p_channel, p_user) on conflict do nothing;
  insert into messages (channel_id, author_id, type, content) values (p_channel, v_uid, 'system', 'added <@' || p_user || '> to the group.');
end $$;

create or replace function public.leave_group_dm(p_channel uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_next uuid;
begin
  if not exists (select 1 from channels where id = p_channel and type = 'group_dm') then
    update channel_recipients set closed = true where channel_id = p_channel and user_id = v_uid;
    return;
  end if;
  delete from channel_recipients where channel_id = p_channel and user_id = v_uid;
  select user_id into v_next from channel_recipients where channel_id = p_channel order by added_at limit 1;
  if v_next is null then
    delete from channels where id = p_channel;
  else
    update channels set owner_id = v_next where id = p_channel and owner_id = v_uid;
    insert into messages (channel_id, author_id, type, content) values (p_channel, v_uid, 'system', 'left the group.');
  end if;
end $$;

-- Starting a call drops a "call" message in the DM; other clients ring when they see it.
create or replace function public.start_call(p_channel uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_recipient(p_channel) then raise exception 'Not in this conversation' using errcode = '42501'; end if;
  insert into messages (channel_id, author_id, type, content) values (p_channel, auth.uid(), 'call', '') returning id into v_id;
  return v_id;
end $$;

-- ---------- Friends --------------------------------------------------------

create or replace function public.send_friend_request(p_username text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_target uuid;
  v_mine text;
  v_theirs text;
begin
  select id into v_target from profiles where username = lower(btrim(regexp_replace(coalesce(p_username, ''), '^@', '')));
  if v_target is null then
    raise exception 'Hm, that didn''t work. Double check that the username is correct.' using errcode = 'P0001';
  end if;
  if v_target = v_uid then raise exception 'You cannot add yourself' using errcode = 'P0001'; end if;
  select type into v_mine from relationships where user_id = v_uid and target_id = v_target;
  select type into v_theirs from relationships where user_id = v_target and target_id = v_uid;
  if v_mine = 'blocked' then raise exception 'Unblock this user first' using errcode = 'P0001'; end if;
  if v_theirs = 'blocked' then raise exception 'Hm, that didn''t work. Double check that the username is correct.' using errcode = 'P0001'; end if;
  if v_mine = 'friend' then raise exception 'You are already friends' using errcode = 'P0001'; end if;
  if v_mine = 'incoming' then
    perform accept_friend_request(v_target);
    return 'friend';
  end if;
  insert into relationships (user_id, target_id, type) values (v_uid, v_target, 'outgoing')
    on conflict (user_id, target_id) do update set type = 'outgoing', created_at = now();
  insert into relationships (user_id, target_id, type) values (v_target, v_uid, 'incoming')
    on conflict (user_id, target_id) do update set type = 'incoming', created_at = now();
  return 'outgoing';
end $$;

create or replace function public.send_friend_request_to(p_user uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  select username into v_name from profiles where id = p_user;
  return send_friend_request(v_name);
end $$;

create or replace function public.accept_friend_request(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if not exists (select 1 from relationships where user_id = v_uid and target_id = p_user and type = 'incoming') then
    raise exception 'No friend request from this user' using errcode = 'P0001';
  end if;
  update relationships set type = 'friend', created_at = now()
   where (user_id = v_uid and target_id = p_user) or (user_id = p_user and target_id = v_uid);
end $$;

create or replace function public.remove_relationship(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  delete from relationships where user_id = v_uid and target_id = p_user;
  delete from relationships where user_id = p_user and target_id = v_uid and type <> 'blocked';
end $$;

create or replace function public.block_user(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if p_user = v_uid then raise exception 'You cannot block yourself' using errcode = 'P0001'; end if;
  delete from relationships where user_id = p_user and target_id = v_uid and type <> 'blocked';
  insert into relationships (user_id, target_id, type) values (v_uid, p_user, 'blocked')
    on conflict (user_id, target_id) do update set type = 'blocked', created_at = now();
end $$;

create or replace function public.unblock_user(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from relationships where user_id = auth.uid() and target_id = p_user and type = 'blocked';
end $$;

-- ---------- Neon (premium) -------------------------------------------------

create or replace function public.start_neon_trial() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  sub public.neon_subscriptions;
begin
  if v_uid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  select * into sub from neon_subscriptions where user_id = v_uid for update;
  if found and sub.trial_used_at is not null then raise exception 'You have already used your free trial' using errcode = 'P0001'; end if;
  if found and sub.expires_at > now() then raise exception 'You already have Neon' using errcode = 'P0001'; end if;
  insert into neon_subscriptions (user_id, tier, started_at, expires_at, source, trial_used_at)
  values (v_uid, 'neon', now(), now() + interval '7 days', 'trial', now())
  on conflict (user_id) do update set tier = 'neon', started_at = now(), expires_at = now() + interval '7 days',
                                      source = 'trial', trial_used_at = now(), updated_at = now();
  return (select to_jsonb(n) from neon_subscriptions n where n.user_id = v_uid);
end $$;

create or replace function public.redeem_neon_code(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  c public.neon_codes;
  sub public.neon_subscriptions;
  v_tier text;
  v_from timestamptz;
begin
  if v_uid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  select * into c from neon_codes where code = btrim(p_code) for update;
  if not found or (c.expires_at is not null and c.expires_at < now()) or (c.max_uses > 0 and c.uses >= c.max_uses) then
    raise exception 'That gift code is invalid or has already been used' using errcode = 'P0001';
  end if;
  if exists (select 1 from neon_code_redemptions where code = c.code and user_id = v_uid) then
    raise exception 'You already redeemed this code' using errcode = 'P0001';
  end if;
  insert into neon_code_redemptions (code, user_id) values (c.code, v_uid);
  update neon_codes set uses = uses + 1 where code = c.code;

  select * into sub from neon_subscriptions where user_id = v_uid for update;
  if found and sub.expires_at > now() then
    v_tier := case when sub.tier = 'neon' or c.tier = 'neon' then 'neon' else 'lite' end;
    v_from := sub.expires_at;
  else
    v_tier := c.tier;
    v_from := now();
  end if;
  insert into neon_subscriptions (user_id, tier, started_at, expires_at, source)
  values (v_uid, v_tier, now(), v_from + make_interval(days => c.days), 'code')
  on conflict (user_id) do update set tier = v_tier,
    started_at = case when neon_subscriptions.expires_at > now() then neon_subscriptions.started_at else now() end,
    expires_at = v_from + make_interval(days => c.days), source = 'code', updated_at = now();
  return (select to_jsonb(n) from neon_subscriptions n where n.user_id = v_uid);
end $$;

-- Admin only (SQL editor / service role): make gift codes and grant Neon.
--   select public.admin_create_neon_code('neon', 30, 1, 'for a friend');
create or replace function public.admin_create_neon_code(p_tier text default 'neon', p_days int default 30, p_max_uses int default 1, p_note text default null)
returns text
language plpgsql security definer set search_path = public as $$
declare v_code text := upper(random_code(4) || '-' || random_code(4) || '-' || random_code(4));
begin
  insert into neon_codes (code, tier, days, max_uses, note) values (v_code, p_tier, p_days, p_max_uses, p_note);
  return v_code;
end $$;

--   select public.admin_grant_neon('<user uuid>', 'neon', 30);
create or replace function public.admin_grant_neon(p_user uuid, p_tier text default 'neon', p_days int default 30) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into neon_subscriptions (user_id, tier, started_at, expires_at, source)
  values (p_user, p_tier, now(), now() + make_interval(days => p_days), 'gift')
  on conflict (user_id) do update set tier = excluded.tier,
    expires_at = greatest(neon_subscriptions.expires_at, now()) + make_interval(days => p_days), updated_at = now();
end $$;

create or replace function public.boost_server(p_server uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_used int; v_channel uuid;
begin
  if neon_tier(v_uid) is distinct from 'neon' then
    raise exception 'Boosting needs Neon — every Neon member gets 2 boosts' using errcode = 'P0001';
  end if;
  if not is_member(p_server) then raise exception 'Join the server first' using errcode = 'P0001'; end if;
  select count(*) into v_used from boosts where user_id = v_uid;
  if v_used >= 2 then raise exception 'You have used both of your boosts. Remove one to boost here.' using errcode = 'P0001'; end if;
  insert into boosts (server_id, user_id) values (p_server, v_uid);
  select system_channel_id into v_channel from servers where id = p_server;
  if v_channel is not null then
    insert into messages (channel_id, author_id, type, content) values (v_channel, v_uid, 'boost', '');
  end if;
end $$;

create or replace function public.remove_boost(p_server uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from boosts where id = (select id from boosts where server_id = p_server and user_id = auth.uid() order by created_at desc limit 1);
end $$;

-- ---------- Scheduled messages (new) --------------------------------------
-- Any signed-in client calls this every minute; it posts whatever is due.
-- (Optional: schedule it with pg_cron instead — see SUPABASE_SETUP.md.)
create or replace function public.publish_due_messages() returns int
language plpgsql security definer set search_path = public as $$
declare r public.scheduled_messages; v_count int := 0;
begin
  for r in select * from scheduled_messages where send_at <= now() order by send_at for update skip locked loop
    begin
      insert into messages (channel_id, author_id, content) values (r.channel_id, r.user_id, r.content);
      v_count := v_count + 1;
    exception when others then
      null;   -- lost access or blocked by AutoMod: drop it quietly
    end;
    delete from scheduled_messages where id = r.id;
  end loop;
  return v_count;
end $$;

-- ---------- Account --------------------------------------------------------

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  if exists (select 1 from servers where owner_id = v_uid) then
    raise exception 'Transfer or delete the servers you own first' using errcode = 'P0001';
  end if;
  delete from auth.users where id = v_uid;
end $$;

-- -----------------------------------------------------------------------------
-- 6. Row Level Security
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.neon_subscriptions enable row level security;
alter table public.neon_codes enable row level security;
alter table public.neon_code_redemptions enable row level security;
alter table public.servers enable row level security;
alter table public.server_members enable row level security;
alter table public.roles enable row level security;
alter table public.member_roles enable row level security;
alter table public.channels enable row level security;
alter table public.channel_recipients enable row level security;
alter table public.permission_overwrites enable row level security;
alter table public.messages enable row level security;
alter table public.reactions enable row level security;
alter table public.poll_votes enable row level security;
alter table public.read_states enable row level security;
alter table public.relationships enable row level security;
alter table public.invites enable row level security;
alter table public.bans enable row level security;
alter table public.audit_log enable row level security;
alter table public.emojis enable row level security;
alter table public.stickers enable row level security;
alter table public.soundboard_sounds enable row level security;
alter table public.server_events enable row level security;
alter table public.event_rsvps enable row level security;
alter table public.boosts enable row level security;
alter table public.bookmarks enable row level security;
alter table public.reminders enable row level security;
alter table public.scheduled_messages enable row level security;
alter table public.notification_settings enable row level security;
alter table public.automod_rules enable row level security;

-- Drop every policy this file manages so re-running gives a clean slate.
do $$
declare p record;
begin
  for p in select schemaname, tablename, policyname from pg_policies
           where schemaname = 'public' and policyname like 'cl_%' loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- profiles
create policy cl_profiles_select on public.profiles for select to authenticated using (true);
create policy cl_profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- settings
create policy cl_settings_all on public.user_settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- neon (read-only from the browser; badges are public)
create policy cl_neon_select on public.neon_subscriptions for select to authenticated using (true);

-- servers
create policy cl_servers_select on public.servers for select to authenticated
  using (is_public or is_member(id));
create policy cl_servers_update on public.servers for update to authenticated
  using (has_server_perm(id, perm('MANAGE_SERVER'))) with check (has_server_perm(id, perm('MANAGE_SERVER')) or owner_id <> (select auth.uid()));
create policy cl_servers_delete on public.servers for delete to authenticated
  using (owner_id = (select auth.uid()));

-- members
create policy cl_members_select on public.server_members for select to authenticated
  using (is_member(server_id));
create policy cl_members_leave on public.server_members for delete to authenticated
  using (user_id = (select auth.uid()) and not exists (select 1 from public.servers s where s.id = server_id and s.owner_id = (select auth.uid())));

-- roles
create policy cl_roles_select on public.roles for select to authenticated using (is_member(server_id));
create policy cl_roles_insert on public.roles for insert to authenticated with check (has_server_perm(server_id, perm('MANAGE_ROLES')));
create policy cl_roles_update on public.roles for update to authenticated
  using (can_manage_role(id) or (is_default and has_server_perm(server_id, perm('MANAGE_ROLES'))))
  with check (has_server_perm(server_id, perm('MANAGE_ROLES')));
create policy cl_roles_delete on public.roles for delete to authenticated using (can_manage_role(id) and not is_default);

create policy cl_member_roles_select on public.member_roles for select to authenticated using (is_member(server_id));
create policy cl_member_roles_insert on public.member_roles for insert to authenticated with check (can_manage_role(role_id));
create policy cl_member_roles_delete on public.member_roles for delete to authenticated using (can_manage_role(role_id));

-- channels
create policy cl_channels_select on public.channels for select to authenticated
  using (can_view_channel_row(id, server_id, type, parent_id, thread_parent_id, locked));
create policy cl_channels_insert on public.channels for insert to authenticated with check (
  (type not in ('thread','dm','group_dm') and has_server_perm(server_id, perm('MANAGE_CHANNELS')))
  or (type = 'thread' and has_channel_perm(thread_parent_id, perm('CREATE_THREADS'))));
create policy cl_channels_update on public.channels for update to authenticated using (
  (type not in ('thread','dm','group_dm') and has_channel_perm(id, perm('MANAGE_CHANNELS')))
  or (type = 'thread' and (owner_id = (select auth.uid()) or has_channel_perm(thread_parent_id, perm('MANAGE_THREADS'))))
  or (type = 'group_dm' and is_recipient(id)));
create policy cl_channels_delete on public.channels for delete to authenticated using (
  (type not in ('thread','dm','group_dm') and has_server_perm(server_id, perm('MANAGE_CHANNELS')))
  or (type = 'thread' and (owner_id = (select auth.uid()) or has_channel_perm(thread_parent_id, perm('MANAGE_THREADS')))));

create policy cl_recipients_select on public.channel_recipients for select to authenticated using (is_recipient(channel_id));
create policy cl_recipients_update on public.channel_recipients for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy cl_overwrites_select on public.permission_overwrites for select to authenticated using (can_view_channel(channel_id));
create policy cl_overwrites_write on public.permission_overwrites for all to authenticated
  using (exists (select 1 from public.channels c where c.id = channel_id and c.server_id is not null and has_server_perm(c.server_id, perm('MANAGE_ROLES'))))
  with check (exists (select 1 from public.channels c where c.id = channel_id and c.server_id is not null and has_server_perm(c.server_id, perm('MANAGE_ROLES'))));

-- messages
create policy cl_messages_select on public.messages for select to authenticated using (can_read_channel(channel_id));
create policy cl_messages_insert on public.messages for insert to authenticated with check (
  author_id = (select auth.uid()) and type = 'default' and has_channel_perm(channel_id, perm('SEND_MESSAGES')));
create policy cl_messages_update on public.messages for update to authenticated using (
  author_id = (select auth.uid())
  or (server_id is not null and has_channel_perm(channel_id, perm('MANAGE_MESSAGES')))
  or (server_id is null and is_recipient(channel_id)));
create policy cl_messages_delete on public.messages for delete to authenticated using (
  (author_id = (select auth.uid()) and type in ('default','call'))
  or (server_id is not null and has_channel_perm(channel_id, perm('MANAGE_MESSAGES'))));

create policy cl_reactions_select on public.reactions for select to authenticated using (can_read_channel(channel_id));
create policy cl_reactions_insert on public.reactions for insert to authenticated with check (
  user_id = (select auth.uid()) and can_read_channel(channel_id));
create policy cl_reactions_delete on public.reactions for delete to authenticated using (
  user_id = (select auth.uid()) or has_channel_perm(channel_id, perm('MANAGE_MESSAGES')));

create policy cl_poll_votes_select on public.poll_votes for select to authenticated using (can_read_channel(channel_id));

create policy cl_read_states_all on public.read_states for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy cl_relationships_select on public.relationships for select to authenticated using (user_id = (select auth.uid()));

-- invites
create policy cl_invites_select on public.invites for select to authenticated using (is_member(server_id));
create policy cl_invites_insert on public.invites for insert to authenticated with check (has_server_perm(server_id, perm('CREATE_INVITE')));
create policy cl_invites_delete on public.invites for delete to authenticated using (
  inviter_id = (select auth.uid()) or has_server_perm(server_id, perm('MANAGE_SERVER')));

create policy cl_bans_select on public.bans for select to authenticated using (has_server_perm(server_id, perm('BAN_MEMBERS')));
create policy cl_audit_select on public.audit_log for select to authenticated using (has_server_perm(server_id, perm('VIEW_AUDIT_LOG')));

-- expressions
create policy cl_emojis_select on public.emojis for select to authenticated using (true);
create policy cl_emojis_write on public.emojis for all to authenticated
  using (has_server_perm(server_id, perm('MANAGE_EXPRESSIONS'))) with check (has_server_perm(server_id, perm('MANAGE_EXPRESSIONS')));
create policy cl_stickers_select on public.stickers for select to authenticated using (true);
create policy cl_stickers_write on public.stickers for all to authenticated
  using (has_server_perm(server_id, perm('MANAGE_EXPRESSIONS'))) with check (has_server_perm(server_id, perm('MANAGE_EXPRESSIONS')));
create policy cl_sounds_select on public.soundboard_sounds for select to authenticated using (is_member(server_id));
create policy cl_sounds_write on public.soundboard_sounds for all to authenticated
  using (has_server_perm(server_id, perm('MANAGE_EXPRESSIONS'))) with check (has_server_perm(server_id, perm('MANAGE_EXPRESSIONS')));

-- events
create policy cl_events_select on public.server_events for select to authenticated using (is_member(server_id));
create policy cl_events_insert on public.server_events for insert to authenticated with check (has_server_perm(server_id, perm('MANAGE_EVENTS')));
create policy cl_events_update on public.server_events for update to authenticated using (
  creator_id = (select auth.uid()) or has_server_perm(server_id, perm('MANAGE_EVENTS')));
create policy cl_events_delete on public.server_events for delete to authenticated using (
  creator_id = (select auth.uid()) or has_server_perm(server_id, perm('MANAGE_EVENTS')));
create policy cl_rsvps_select on public.event_rsvps for select to authenticated using (is_member(server_id));
create policy cl_rsvps_insert on public.event_rsvps for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (select 1 from public.server_events e where e.id = event_id and is_member(e.server_id)));
create policy cl_rsvps_delete on public.event_rsvps for delete to authenticated using (user_id = (select auth.uid()));

create policy cl_boosts_select on public.boosts for select to authenticated using (is_member(server_id) or user_id = (select auth.uid()));

-- personal stuff
create policy cl_bookmarks_all on public.bookmarks for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy cl_reminders_all on public.reminders for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy cl_scheduled_select on public.scheduled_messages for select to authenticated using (user_id = (select auth.uid()));
create policy cl_scheduled_insert on public.scheduled_messages for insert to authenticated with check (
  user_id = (select auth.uid()) and has_channel_perm(channel_id, perm('SEND_MESSAGES')) and send_at > now());
create policy cl_scheduled_delete on public.scheduled_messages for delete to authenticated using (user_id = (select auth.uid()));
create policy cl_notifications_all on public.notification_settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy cl_automod_all on public.automod_rules for all to authenticated
  using (has_server_perm(server_id, perm('MANAGE_SERVER'))) with check (has_server_perm(server_id, perm('MANAGE_SERVER')));

-- -----------------------------------------------------------------------------
-- 7. Grants
-- -----------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
grant execute on function public.get_invite(text), public.username_available(text), public.perm(text) to anon;

-- Internal helpers: callable from policies/functions, not directly from the browser.
revoke execute on function public.server_permissions(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.channel_permissions(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.channel_permissions_for(uuid, uuid, text, uuid, uuid, boolean, uuid) from public, anon, authenticated;
revoke execute on function public.member_top_position(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.outranks(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.message_json(public.messages, uuid) from public, anon, authenticated;
revoke execute on function public.admin_create_neon_code(text, int, int, text) from public, anon, authenticated;
revoke execute on function public.admin_grant_neon(uuid, text, int) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 8. Storage: one public "media" bucket; everyone uploads into a folder named
--    after their user id (avatars, banners, icons, emoji, attachments…)
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 52428800)
on conflict (id) do update set public = true;

drop policy if exists "cityline media read own" on storage.objects;
drop policy if exists "cityline media upload" on storage.objects;
drop policy if exists "cityline media update" on storage.objects;
drop policy if exists "cityline media delete" on storage.objects;
create policy "cityline media read own" on storage.objects for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "cityline media upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "cityline media update" on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "cityline media delete" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid()::text));

-- -----------------------------------------------------------------------------
-- 9. Realtime: stream changes on these tables to the app
-- -----------------------------------------------------------------------------

do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['profiles','servers','server_members','roles','member_roles','channels','channel_recipients',
                           'permission_overwrites','messages','reactions','poll_votes','read_states','relationships',
                           'emojis','stickers','soundboard_sounds','server_events','event_rsvps','boosts','neon_subscriptions',
                           'reminders','user_settings','notification_settings'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Let the API pick up the new tables and functions straight away.
notify pgrst, 'reload schema';
