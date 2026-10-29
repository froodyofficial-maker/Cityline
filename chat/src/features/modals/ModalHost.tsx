import { AnimatePresence } from 'motion/react';
import { useUI, type ModalSpec } from '../../store/ui';
import { BoostModal, CatchUpModal, CreateChannelModal, CreateEventModal, CreateServerModal, EventsModal, InviteModal, JoinServerModal, LeaderboardModal, ModerateModal, NicknameModal } from './ServerModals';
import { CreateGroupModal, CreateThreadModal, ForwardModal, PollModal, ReminderModal, ScheduleModal } from './MessageModals';
import { ConfirmModal, ProfileModal, ShortcutsModal, StatusModal } from './MiscModals';

import { UserSettings } from '../settings/UserSettings';
import { ServerSettings } from '../settings/ServerSettings';
import { ChannelSettings } from '../settings/ChannelSettings';

function render(m: ModalSpec) {
  switch (m.kind) {
    case 'createServer': return <CreateServerModal />;
    case 'joinServer': return <JoinServerModal code={m.code} />;
    case 'createChannel': return <CreateChannelModal serverId={m.serverId} parentId={m.parentId ?? null} type={m.type} />;
    case 'invite': return <InviteModal serverId={m.serverId} channelId={m.channelId ?? null} />;
    case 'serverSettings': return <ServerSettings serverId={m.serverId} tab={m.tab} />;
    case 'channelSettings': return <ChannelSettings channelId={m.channelId} tab={m.tab} />;
    case 'userSettings': return <UserSettings tab={m.tab} />;
    case 'profile': return <ProfileModal userId={m.userId} serverId={m.serverId ?? null} />;
    case 'poll': return <PollModal channelId={m.channelId} />;
    case 'schedule': return <ScheduleModal channelId={m.channelId} content={m.content} />;
    case 'reminder': return <ReminderModal messageId={m.messageId} channelId={m.channelId} />;
    case 'forward': return <ForwardModal messageId={m.messageId} />;
    case 'createThread': return <CreateThreadModal channelId={m.channelId} messageId={m.messageId} forum={m.forum} />;
    case 'createGroup': return <CreateGroupModal />;
    case 'events': return <EventsModal serverId={m.serverId} />;
    case 'createEvent': return <CreateEventModal serverId={m.serverId} />;
    case 'leaderboard': return <LeaderboardModal serverId={m.serverId} />;
    case 'catchUp': return <CatchUpModal serverId={m.serverId} />;
    case 'shortcuts': return <ShortcutsModal />;
    case 'nickname': return <NicknameModal serverId={m.serverId} userId={m.userId} />;
    case 'moderate': return <ModerateModal serverId={m.serverId} userId={m.userId} action={m.action} />;
    case 'status': return <StatusModal />;
    case 'boost': return <BoostModal serverId={m.serverId} />;
    case 'confirm': return <ConfirmModal spec={m} />;
  }
}

export function ModalHost() {
  const modals = useUI((s) => s.modals);
  return (
    <AnimatePresence>
      {modals.map((m, i) => <ModalSlot key={`${m.kind}-${i}`} spec={m} />)}
    </AnimatePresence>
  );
}

function ModalSlot({ spec }: { spec: ModalSpec }) {
  return render(spec);
}

