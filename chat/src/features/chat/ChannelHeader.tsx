import { AtSign, Bell, BellOff, Inbox, Menu, MessagesSquare, Phone, Pin, Search, UserPlus, Users, Video, X, CircleHelp } from 'lucide-react';
import { useState } from 'react';
import { Avatar } from '../../components/ui/Avatar';
import { Tip } from '../../components/ui/Tooltip';
import { renderMarkdown } from '../../lib/markdown';
import type { Channel } from '../../lib/types';
import { cn } from '../../lib/utils';
import { joinVoice, toggleCamera } from '../../lib/voice';
import { useData } from '../../store/data';
import { dmName, isMuted, usePresence } from '../../store/selectors';
import { openModal, setRightPanel, setUI, useUI } from '../../store/ui';
import { setNotification } from '../../store/actions/servers';
import { startCall } from '../../store/actions/users';
import { useVoice } from '../../store/voice';
import { channelIcon } from '../sidebar/ServerSidebar';
import { InboxPopover } from '../panels/InboxPopover';

export function ChannelHeader({ channel }: { channel: Channel }) {
  const rightPanel = useUI((s) => s.rightPanel);
  const inbox = useUI((s) => s.inbox);
  const name = useData((s) => (channel.server_id ? channel.name : dmName(channel, s)));
  const other = useData((s) => (channel.type === 'dm' ? channel.recipients?.find((id) => id !== s.me) : undefined));
  const otherStatus = usePresence(other);
  const muted = useData((s) => isMuted(channel.id, s));
  const inThisCall = useVoice((s) => s.channelId === channel.id);
  const [query, setQuery] = useState('');
  const isDM = !channel.server_id;
  const toggle = (p: typeof rightPanel) => setRightPanel(rightPanel === p ? null : p);

  async function call(video: boolean) {
    if (!inThisCall) {
      await startCall(channel.id).catch(() => {});
      await joinVoice(channel.id, null);
    }
    if (video && !useVoice.getState().localCamera) await toggleCamera();
  }

  return (
    <header className="chat-header">
      <button className="icon-btn only-mobile" onClick={() => setUI({ mobileNav: true })} aria-label="Open navigation"><Menu /></button>
      <div className="chat-title">
        {isDM ? (
          channel.type === 'dm' ? <Avatar userId={other} size={26} showStatus status={otherStatus} ring="var(--bg-chat)" /> : <span className="hdr-icon"><Users size={22} /></span>
        ) : (
          <span className="hdr-icon">{channelIcon(channel, 22)}</span>
        )}
        <h1 className="ellipsis">{name}</h1>
        {channel.type === 'thread' && <span className="chip">thread</span>}
        {channel.topic && (
          <>
            <span className="hdr-sep" />
            <button className="chat-topic ellipsis" onClick={() => openModal({ kind: 'confirm', title: `#${channel.name}`, body: <div className="md">{renderMarkdown(channel.topic, { serverId: channel.server_id })}</div>, confirm: 'Close', onConfirm: () => {} })}>
              {renderMarkdown(channel.topic, { inline: true, serverId: channel.server_id })}
            </button>
          </>
        )}
      </div>
      <div className="chat-tools">
        {isDM && (
          <>
            <Tip label="Start Voice Call" side="bottom"><button className="icon-btn" onClick={() => void call(false)}><Phone /></button></Tip>
            <Tip label="Start Video Call" side="bottom"><button className="icon-btn" onClick={() => void call(true)}><Video /></button></Tip>
            {channel.type === 'group_dm' && <Tip label="Add Friends to DM" side="bottom"><button className="icon-btn" onClick={() => openModal({ kind: 'createGroup' })}><UserPlus /></button></Tip>}
          </>
        )}
        {!isDM && channel.type !== 'thread' && (
          <Tip label="Threads" side="bottom"><button className={cn('icon-btn', rightPanel === 'threads' && 'active')} onClick={() => toggle('threads')}><MessagesSquare /></button></Tip>
        )}
        {!isDM && (
          <Tip label={muted ? 'Unmute Channel' : 'Mute Channel'} side="bottom">
            <button className={cn('icon-btn', muted && 'active')} onClick={() => void setNotification(channel.id, { muted: !muted })}>{muted ? <BellOff /> : <Bell />}</button>
          </Tip>
        )}
        <Tip label="Pinned Messages" side="bottom"><button className={cn('icon-btn', rightPanel === 'pins' && 'active')} onClick={() => toggle('pins')}><Pin /></button></Tip>
        {(!isDM || channel.type === 'dm') && (
          <Tip label={isDM ? (rightPanel === 'members' ? 'Hide User Profile' : 'Show User Profile') : rightPanel === 'members' ? 'Hide Member List' : 'Show Member List'} side="bottom">
            <button className={cn('icon-btn', rightPanel === 'members' && 'active')} onClick={() => toggle('members')}>{isDM ? <AtSign /> : <Users />}</button>
          </Tip>
        )}
        {channel.type === 'group_dm' && (
          <Tip label="Member List" side="bottom"><button className={cn('icon-btn', rightPanel === 'members' && 'active')} onClick={() => toggle('members')}><Users /></button></Tip>
        )}
        <form className="hdr-search" onSubmit={(e) => { e.preventDefault(); setUI({ searchQuery: { serverId: channel.server_id, channelId: isDM ? channel.id : null, query } }); setRightPanel('search'); }}>
          <input placeholder={isDM ? 'Search' : `Search ${useData.getState().servers[channel.server_id!]?.name ?? ''}`} value={query} onChange={(e) => setQuery(e.target.value)} />
          {query ? <button type="button" className="hdr-search-x" onClick={() => { setQuery(''); if (rightPanel === 'search') setRightPanel(null); }}><X size={16} /></button> : <Search size={16} />}
        </form>
        <div className="inbox-anchor">
          <Tip label="Inbox" side="bottom"><button className={cn('icon-btn', inbox && 'active')} onClick={() => setUI({ inbox: !inbox })}><Inbox /></button></Tip>
          {inbox && <InboxPopover />}
        </div>
        <Tip label="Help & shortcuts" side="bottom"><button className="icon-btn hide-mobile" onClick={() => openModal({ kind: 'shortcuts' })}><CircleHelp /></button></Tip>
      </div>
    </header>
  );
}
