import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useData } from '../../store/data';
import { loadMessages, markRead } from '../../store/actions/messages';
import { loadMembers } from '../../store/actions/servers';
import { useTypingChannel } from '../../store/realtime';
import { useUI } from '../../store/ui';
import { useVoice } from '../../store/voice';
import { ChannelHeader } from './ChannelHeader';
import { MessageList } from './MessageList';
import { Composer } from './Composer';
import { MemberList } from '../members/MemberList';
import { PinsPanel } from '../panels/PinsPanel';
import { SearchPanel } from '../panels/SearchPanel';
import { ThreadPanel } from '../panels/ThreadPanel';
import { ThreadsPanel } from '../panels/ThreadsPanel';
import { DMProfilePanel } from '../profile/DMProfilePanel';
import { DMCallStage } from '../voice/DMCallStage';
import { DropZone } from './DropZone';
import { rememberChannel } from '../rail/ServerRail';
import { useVoiceMembers } from '../../store/selectors';
import { cn } from '../../lib/utils';

export function ChatView({ channelId }: { channelId: string }) {
  const channel = useData((s) => s.channels[channelId]);
  const rightPanel = useUI((s) => s.rightPanel);
  const threadId = useUI((s) => s.threadId);
  const [files, setFiles] = useState<File[] | null>(null);
  const inCall = useVoice((s) => s.channelId === channelId);
  const othersInCall = useVoiceMembers(channelId).length > 0;
  useTypingChannel(channelId);

  useEffect(() => {
    void loadMessages(channelId);
    if (channel?.server_id) {
      void loadMembers(channel.server_id);
      rememberChannel(channel.server_id, channelId);
    }
    markRead(channelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  // mark read when the window regains focus
  useEffect(() => {
    const onFocus = () => markRead(channelId);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [channelId]);

  if (!channel) return null;
  const isDM = channel.type === 'dm' || channel.type === 'group_dm';
  let panel: React.ReactNode = null;
  if (rightPanel === 'members') panel = isDM && channel.type === 'dm' ? <DMProfilePanel channelId={channelId} /> : <MemberList channelId={channelId} />;
  else if (rightPanel === 'pins') panel = <PinsPanel channelId={channelId} />;
  else if (rightPanel === 'search') panel = <SearchPanel channelId={channelId} />;
  else if (rightPanel === 'thread' && threadId) panel = <ThreadPanel key={threadId} threadId={threadId} />;
  else if (rightPanel === 'threads') panel = <ThreadsPanel channelId={channelId} />;

  return (
    <div className="chat">
      <ChannelHeader channel={channel} />
      <div className="chat-body">
        <div className="chat-main">
          {isDM && (inCall || othersInCall) && <DMCallStage channelId={channelId} />}
          <MessageList channelId={channelId} />
          <Composer channelId={channelId} pendingFiles={files} onFilesTaken={() => setFiles(null)} />
          <DropZone onFiles={setFiles} channelId={channelId} />
        </div>
        <AnimatePresence initial={false}>
          {panel && (
            <motion.aside
              key={rightPanel + (threadId ?? '')}
              className={cn('right-panel', (rightPanel === 'thread' || rightPanel === 'search') && 'wide', rightPanel === 'members' && channel.type === 'dm' && 'profile')}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            >
              {panel}
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
