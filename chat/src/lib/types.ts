// Row shapes as they come back from the database (see supabase/schema.sql).

export type UUID = string;
export type Status = 'online' | 'idle' | 'dnd' | 'invisible';
export type PresenceStatus = 'online' | 'idle' | 'dnd' | 'offline';
export type NeonTier = 'lite' | 'neon' | null;

export interface Profile {
  id: UUID;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  banner_color: string | null;
  bio: string;
  pronouns: string;
  theme_colors: string[] | null;
  avatar_decoration: string | null;
  profile_effect: string | null;
  name_effect: string | null;
  status: Status;
  custom_status: string | null;
  custom_status_emoji: string | null;
  custom_status_expires_at: string | null;
  created_at: string;
  updated_at: string;
  neon?: NeonTier;
}

export interface NeonSubscription {
  user_id: UUID;
  tier: 'lite' | 'neon';
  started_at: string;
  expires_at: string;
  source: string;
  trial_used_at: string | null;
}

export interface Server {
  id: UUID;
  name: string;
  description: string;
  icon_url: string | null;
  banner_url: string | null;
  owner_id: UUID;
  is_public: boolean;
  tags: string[];
  system_channel_id: UUID | null;
  welcome_message: string;
  xp_enabled: boolean;
  accent_color: string | null;
  created_at: string;
  boost_count?: number;
  member_count?: number;
}

export interface Member {
  server_id: UUID;
  user_id: UUID;
  nickname: string | null;
  avatar_url: string | null;
  joined_at: string;
  timeout_until: string | null;
  xp: number;
  last_xp_at?: string | null;
  roles: UUID[];
}

export interface Role {
  id: UUID;
  server_id: UUID;
  name: string;
  color: string | null;
  color2: string | null;
  icon: string | null;
  hoist: boolean;
  mentionable: boolean;
  position: number;
  permissions: number | string;
  is_default: boolean;
  created_at: string;
}

export type ChannelType = 'text' | 'voice' | 'announcement' | 'forum' | 'stage' | 'category' | 'dm' | 'group_dm' | 'thread';

export interface ForumTag { id: string; name: string; emoji?: string | null }

export interface Channel {
  id: UUID;
  server_id: UUID | null;
  type: ChannelType;
  name: string;
  topic: string;
  position: number;
  parent_id: UUID | null;
  thread_parent_id: UUID | null;
  starter_message_id: UUID | null;
  owner_id: UUID | null;
  icon_url: string | null;
  nsfw: boolean;
  slowmode_seconds: number;
  user_limit: number;
  archived: boolean;
  locked: boolean;
  available_tags: ForumTag[];
  applied_tags: string[];
  emoji: string | null;
  last_message_at: string | null;
  message_count: number;
  created_at: string;
  // DMs only (from bootstrap)
  recipients?: UUID[];
  closed?: boolean;
}

export interface Overwrite {
  channel_id: UUID;
  target_id: UUID;
  target_type: 'role' | 'member';
  allow: number | string;
  deny: number | string;
}

export interface Attachment {
  url: string;
  name: string;
  size: number;
  type: string;
  width?: number;
  height?: number;
  spoiler?: boolean;
  duration?: number;
  waveform?: number[];
}

export interface Embed {
  url: string;
  title?: string;
  description?: string;
  site_name?: string;
  image?: string;
  video?: string;
  color?: string;
  type?: 'link' | 'image' | 'video' | 'youtube' | 'gif';
}

export interface PollOption { id: string; text: string; emoji?: string | null }
export interface Poll { question: string; options: PollOption[]; multi?: boolean; expires_at?: string | null }

export interface ReactionAgg { emoji: string; count: number; super_count: number; me: boolean; me_super: boolean }

export type MessageType = 'default' | 'join' | 'pin' | 'boost' | 'call' | 'thread' | 'system';

export interface Message {
  id: UUID;
  channel_id: UUID;
  server_id: UUID | null;
  author_id: UUID | null;
  type: MessageType;
  content: string;
  attachments: Attachment[];
  embeds: Embed[];
  sticker: { id?: string; name: string; url: string } | null;
  poll: Poll | null;
  forwarded: { author_id: UUID | null; content: string; attachments: Attachment[]; channel_id: UUID; created_at: string } | null;
  effect: string | null;
  reply_to_id: UUID | null;
  thread_id: UUID | null;
  mentions: UUID[];
  mention_roles: UUID[];
  mention_everyone: boolean;
  pinned: boolean;
  pinned_at: string | null;
  flags: number;
  nonce: string | null;
  edited_at: string | null;
  created_at: string;
  // extras from get_messages
  reactions?: ReactionAgg[];
  poll_results?: { option_id: string; count: number; me: boolean }[] | null;
  reply?: { id: UUID; author_id: UUID | null; content: string; attachments: number; type: MessageType } | null;
  thread?: { id: UUID; name: string; message_count: number; last_message_at: string | null; archived: boolean } | null;
  // client only
  pending?: boolean;
  failed?: string;
  score?: number;
}

export interface ReadState { user_id: UUID; channel_id: UUID; last_read_at: string; mention_count: number }

export interface Relationship { user_id: UUID; target_id: UUID; type: 'friend' | 'incoming' | 'outgoing' | 'blocked'; created_at: string }

export interface Invite {
  code: string;
  server_id: UUID;
  channel_id: UUID | null;
  inviter_id: UUID | null;
  max_uses: number;
  uses: number;
  expires_at: string | null;
  created_at: string;
}

export interface CustomEmoji { id: UUID; server_id: UUID; name: string; url: string; animated: boolean; created_by: UUID | null; created_at: string }
export interface Sticker { id: UUID; server_id: UUID; name: string; description: string; url: string; created_by: UUID | null; created_at: string }
export interface Sound { id: UUID; server_id: UUID; name: string; emoji: string | null; url: string; volume: number; created_by: UUID | null }

export interface ServerEvent {
  id: UUID;
  server_id: UUID;
  channel_id: UUID | null;
  location: string | null;
  name: string;
  description: string;
  image_url: string | null;
  starts_at: string;
  ends_at: string | null;
  status: 'scheduled' | 'active' | 'completed' | 'canceled';
  creator_id: UUID | null;
  created_at: string;
}

export interface NotificationSetting { user_id: UUID; target_id: UUID; level: 'default' | 'all' | 'mentions' | 'nothing'; muted: boolean; muted_until: string | null }

export interface AuditEntry { id: number; server_id: UUID; actor_id: UUID | null; action: string; target_type: string | null; target_id: string | null; changes: Record<string, unknown> | null; reason: string | null; created_at: string }

export interface AutomodRule { id: UUID; server_id: UUID; name: string; type: 'keyword' | 'links' | 'invites' | 'mention_spam' | 'caps'; keywords: string[]; mention_limit: number; enabled: boolean; created_at: string }

export interface Boost { id: UUID; server_id: UUID; user_id: UUID; created_at: string }

export interface Reminder { id: UUID; user_id: UUID; message_id: UUID | null; channel_id: UUID | null; note: string; remind_at: string; done: boolean; created_at: string }

export interface ScheduledMessage { id: UUID; user_id: UUID; channel_id: UUID; content: string; send_at: string; created_at: string }

export interface VoiceState {
  channel_id: UUID;
  server_id: UUID | null;
  muted: boolean;
  deafened: boolean;
  video: boolean;
  screen: boolean;
  joined_at: number;
}

export interface PresenceMeta {
  user_id: UUID;
  status: PresenceStatus;
  voice: VoiceState | null;
  activity?: { name: string; emoji?: string | null } | null;
  at: number;
}

export interface UserSettings {
  theme?: string;
  fontScale?: number;
  compact?: boolean;
  reducedMotion?: boolean;
  saturation?: number;
  showEffects?: boolean;
  developerMode?: boolean;
  notifyDesktop?: boolean;
  notifySounds?: boolean;
  quickReactions?: string[];
  folders?: { id: string; name: string; color: string; servers: UUID[] }[];
  serverOrder?: UUID[];
  collapsed?: Record<string, boolean>;
  inputDevice?: string;
  outputDevice?: string;
  videoDevice?: string;
  noiseSuppression?: boolean;
  pushToTalk?: boolean;
  pttKey?: string;
  inputSensitivity?: number;
  streamerMode?: boolean;
  focusUntil?: number | null;
  recentEmoji?: string[];
  skinTone?: number;
  chatWidth?: 'normal' | 'wide';
  roundedAvatars?: boolean;
  timestamps24h?: boolean;
}

export interface Bootstrap {
  me: Profile;
  neon: NeonSubscription | null;
  settings: UserSettings;
  servers: (Server & { my_perms: number })[];
  memberships: Member[];
  roles: Role[];
  channels: (Channel & { my_perms: number })[];
  dm_channels: (Channel & { my_perms: number; recipients: UUID[]; closed: boolean })[];
  overwrites: Overwrite[];
  read_states: ReadState[];
  relationships: Relationship[];
  profiles: Profile[];
  emojis: CustomEmoji[];
  stickers: Sticker[];
  sounds: Sound[];
  notification_settings: NotificationSetting[];
  my_boosts: Boost[];
}
