import { check, rpc, supabase } from '../../lib/supabase';
import type { NeonSubscription, Profile, Status } from '../../lib/types';
import { bannerImage, squareImage, uploadFile } from '../../lib/upload';
import { setPresenceStatus, stopPresence } from '../../lib/presence';
import { leaveVoice } from '../../lib/voice';
import { playUi } from '../../lib/sounds';
import { getData, initialData, setData, upsertChannel, upsertProfiles } from '../data';
import { navigate, toast } from '../ui';
import { loadBootstrap } from './bootstrap';

// ---------- auth -----------------------------------------------------------------

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message);
}

export async function signUp(email: string, password: string, username: string, displayName: string) {
  const redirect = window.location.href.split('#')[0];
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(), password,
    options: { data: { username: username.trim().toLowerCase(), display_name: displayName.trim() || username.trim() }, emailRedirectTo: redirect },
  });
  if (error) throw new Error(error.message);
  return { needsConfirm: !data.session };
}

export async function signInWithProvider(provider: 'github' | 'google' | 'discord') {
  const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.href.split('#')[0] } });
  if (error) throw new Error(error.message);
}

export async function sendReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.href.split('#')[0] });
  if (error) throw new Error(error.message);
}

export async function changePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

export async function changeEmail(email: string) {
  const { error } = await supabase.auth.updateUser({ email: email.trim() }, { emailRedirectTo: window.location.href.split('#')[0] });
  if (error) throw new Error(error.message);
}

export async function signOut() {
  await leaveVoice(true).catch(() => {});
  stopPresence();
  await supabase.removeAllChannels();
  await supabase.auth.signOut();
  setData({ ...initialData });
  navigate({ kind: 'friends' }, { replace: true });
}

export async function usernameAvailable(name: string) {
  return rpc<boolean>('username_available', { p_username: name });
}

export async function deleteAccount() {
  await rpc('delete_my_account');
  await signOut();
}

// ---------- profile ------------------------------------------------------------------

export async function updateProfile(patch: Partial<Profile>) {
  const me = getData().me!;
  const clean = { ...patch };
  delete clean.neon;
  const row = check(await supabase.from('profiles').update(clean).eq('id', me).select().single()) as Profile;
  upsertProfiles([{ ...row, neon: getData().profiles[me]?.neon ?? null }]);
  return row;
}

export async function uploadAvatar(file: File) {
  const f = await squareImage(file, 512);
  return (await uploadFile(f, 'avatars')).url;
}

export async function uploadBanner(file: File) {
  return (await uploadFile(await bannerImage(file), 'banners')).url;
}

export async function setStatus(status: Status) {
  setPresenceStatus(status);
  await updateProfile({ status });
}

export async function setCustomStatus(text: string | null, emoji: string | null, expiresAt: string | null) {
  await updateProfile({ custom_status: text || null, custom_status_emoji: emoji || null, custom_status_expires_at: expiresAt });
}

export async function getUserProfile(userId: string) {
  const res = await rpc<{ profile: Profile; neon_since: string | null; mutual_servers: string[]; mutual_friends: string[]; relationship: string | null }>('get_user_profile', { p_user: userId });
  if (res.profile) upsertProfiles([res.profile]);
  return res;
}

// ---------- friends & DMs ------------------------------------------------------------

export async function sendFriendRequest(username: string) {
  const res = await rpc<string>('send_friend_request', { p_username: username });
  playUi('success');
  return res;
}
export async function sendFriendRequestTo(userId: string) {
  const res = await rpc<string>('send_friend_request_to', { p_user: userId });
  toast(res === 'friend' ? 'You are now friends!' : 'Friend request sent', 'success', '🤝');
  return res;
}
export const acceptFriend = (userId: string) => rpc('accept_friend_request', { p_user: userId });
export const removeFriend = (userId: string) => rpc('remove_relationship', { p_user: userId });
export const blockUser = (userId: string) => rpc('block_user', { p_user: userId });
export const unblockUser = (userId: string) => rpc('unblock_user', { p_user: userId });

export async function openDM(userId: string) {
  const id = await rpc<string>('open_dm', { p_user: userId });
  if (!getData().channels[id]) await loadBootstrap();
  else setData((s) => ({ channels: { ...s.channels, [id]: { ...s.channels[id], closed: false } } }));
  navigate({ kind: 'dm', channelId: id });
  return id;
}

export async function createGroupDM(userIds: string[], name?: string) {
  const id = await rpc<string>('create_group_dm', { p_users: userIds, p_name: name ?? null });
  await loadBootstrap();
  navigate({ kind: 'dm', channelId: id });
}

export async function addToGroup(channelId: string, userId: string) {
  await rpc('add_group_dm_recipient', { p_channel: channelId, p_user: userId });
  await loadBootstrap();
}

export async function closeDM(channelId: string) {
  const ch = getData().channels[channelId];
  if (ch?.type === 'group_dm') {
    await rpc('leave_group_dm', { p_channel: channelId });
    setData((s) => { const channels = { ...s.channels }; delete channels[channelId]; return { channels }; });
  } else {
    const me = getData().me!;
    if (ch) upsertChannel({ ...ch, closed: true });
    await supabase.from('channel_recipients').update({ closed: true }).match({ channel_id: channelId, user_id: me });
  }
  navigate({ kind: 'friends' });
}

export async function renameGroup(channelId: string, name: string) {
  const ch = check(await supabase.from('channels').update({ name }).eq('id', channelId).select().single());
  upsertChannel({ ...getData().channels[channelId], ...(ch as object) });
}

export async function startCall(channelId: string) {
  await rpc('start_call', { p_channel: channelId });
}

// ---------- neon ---------------------------------------------------------------------

export async function startTrial() {
  const sub = await rpc<NeonSubscription>('start_neon_trial');
  await afterNeonChange(sub);
  toast('Welcome to Neon! Your 7-day trial has started ✨', 'neon', '💎');
}

export async function redeemCode(code: string) {
  const sub = await rpc<NeonSubscription>('redeem_neon_code', { p_code: code.trim() });
  await afterNeonChange(sub);
  toast(`Code redeemed — ${sub.tier === 'neon' ? 'Neon' : 'Neon Lite'} until ${new Date(sub.expires_at).toLocaleDateString()}`, 'neon', '🎁');
}

async function afterNeonChange(sub: NeonSubscription) {
  setData({ neon: sub });
  playUi('boost');
  await loadBootstrap();
}
