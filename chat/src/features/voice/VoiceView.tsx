import { AnimatePresence, motion } from 'motion/react';
import {
  AudioLines, Hand, HeadphoneOff, Headphones, Maximize2, MessageSquare, Mic, MicOff, Minimize2, MonitorUp, MonitorX, PhoneOff, Radio, UserPlus, Users, Video, VideoOff, Volume2, Menu, ArrowUpFromLine, ArrowDownToLine,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar } from '../../components/ui/Avatar';
import { NameTag } from '../../components/ui/NameTag';
import { Tip } from '../../components/ui/Tooltip';
import { has, P } from '../../lib/permissions';
import { cn } from '../../lib/utils';
import { inviteToStage, joinVoice, leaveVoice, setHand, setSpeaker, toggleCamera, toggleDeafen, toggleMute, toggleScreen } from '../../lib/voice';
import { useData } from '../../store/data';
import { usePerms, useVoiceMembers } from '../../store/selectors';
import { openMenu, openModal, setUI, useUI } from '../../store/ui';
import { useVoice, setVoice, type VoiceParticipant } from '../../store/voice';
import { Soundboard } from './Soundboard';
import { MessageList } from '../chat/MessageList';
import { Composer } from '../chat/Composer';
import { loadMessages } from '../../store/actions/messages';
import { useTypingChannel } from '../../store/realtime';
import { memberMenu } from '../members/MemberList';

export function VideoEl({ stream, muted, mirror, contain }: { stream: MediaStream; muted?: boolean; mirror?: boolean; contain?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
    void ref.current?.play().catch(() => {});
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} className={cn(mirror && 'mirror', contain && 'contain')} />;
}

interface Tile { key: string; userId: string; kind: 'user' | 'screen'; stream?: MediaStream | null; p?: VoiceParticipant }

export function VoiceView({ channelId }: { channelId: string }) {
  const channel = useData((s) => s.channels[channelId]);
  const v = useVoice();
  const me = useData((s) => s.me!);
  const connected = v.channelId === channelId && v.status !== 'idle';
  const members = useVoiceMembers(channelId);
  const perms = usePerms(channelId);
  const showChat = useUI((s) => s.showVoiceChat);
  const [board, setBoard] = useState(false);
  const [full, setFull] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const stage = channel?.type === 'stage';
  const isMod = has(perms, P.MUTE_MEMBERS) || has(perms, P.MOVE_MEMBERS);

  useEffect(() => {
    const onFs = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const tiles = useMemo<Tile[]>(() => {
    if (!connected) return [];
    const out: Tile[] = [];
    const ps = Object.values(v.participants).sort((a, b) => a.joined_at - b.joined_at);
    for (const p of ps) {
      const self = p.user_id === me;
      if (stage && !p.speaker && !self) continue;
      if (stage && self && !v.speaker && !isMod) continue;
      out.push({ key: p.user_id, userId: p.user_id, kind: 'user', stream: self ? v.localCamera : v.remote[p.user_id]?.camera, p });
      const scr = self ? v.localScreen : v.remote[p.user_id]?.screen;
      if (p.screen || (self && v.localScreen)) out.push({ key: p.user_id + ':screen', userId: p.user_id, kind: 'screen', stream: scr ?? null, p });
    }
    return out;
  }, [connected, v.participants, v.remote, v.localCamera, v.localScreen, me, stage, v.speaker, isMod]);

  const audience = useMemo(() => (stage ? Object.values(v.participants).filter((p) => !p.speaker && !(p.user_id === me && (v.speaker || isMod))) : []), [stage, v.participants, me, v.speaker, isMod]);
  const focused = v.focused && tiles.find((t) => t.key === v.focused) ? v.focused : null;

  if (!channel) return null;
  const fullscreen = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void root.current?.requestFullscreen(); };

  return (
    <div className={cn('voice-view', stage && 'stage')} ref={root}>
      <header className="voice-head">
        <button className="icon-btn only-mobile" onClick={() => setUI({ mobileNav: true })}><Menu /></button>
        {stage ? <Radio size={20} /> : <Volume2 size={20} />}
        <h1 className="ellipsis">{channel.name}</h1>
        {stage && <span className="chip tiny live-chip">LIVE STAGE</span>}
        <span className="spacer" />
        <Tip label="Invite to channel" side="bottom"><button className="icon-btn" onClick={() => openModal({ kind: 'invite', serverId: channel.server_id!, channelId })}><UserPlus /></button></Tip>
        <Tip label={showChat ? 'Hide Chat' : 'Show Chat'} side="bottom"><button className={cn('icon-btn', showChat && 'active')} onClick={() => setUI({ showVoiceChat: !showChat })}><MessageSquare /></button></Tip>
      </header>
      <div className="voice-body">
        <div className="voice-stage-area">
          {!connected ? (
            <motion.div className="voice-join" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="voice-join-icon">{stage ? <Radio size={40} /> : <Volume2 size={40} />}</div>
              <h2>{channel.name}</h2>
              <p className="muted">{members.length ? `${members.length} ${members.length === 1 ? 'person is' : 'people are'} here` : 'No one is here yet. Be the first!'}</p>
              {members.length > 0 && <div className="avatar-stack" style={{ justifyContent: 'center', margin: '12px 0' }}>{members.slice(0, 8).map((m) => <Avatar key={m.user_id} userId={m.user_id} size={40} ring="var(--bg-chat)" />)}</div>}
              <button className="btn lg" disabled={!has(perms, P.CONNECT)} onClick={() => void joinVoice(channelId, channel.server_id)}>{has(perms, P.CONNECT) ? 'Join Voice' : 'No permission to join'}</button>
            </motion.div>
          ) : (
            <>
              {stage && <StageBanner isMod={isMod} />}
              <div className={cn('tiles', focused && 'focused', `n${Math.min(tiles.length, 9)}`)}>
                <AnimatePresence>
                  {tiles.filter((t) => !focused || t.key === focused).map((t) => (
                    <TileView key={t.key} tile={t} big={!!focused} me={me} serverId={channel.server_id} onFocus={() => setVoice({ focused: focused === t.key ? null : t.key })} />
                  ))}
                </AnimatePresence>
                {!tiles.length && <div className="empty"><div className="art">🎙️</div><h3>Waiting for speakers</h3></div>}
              </div>
              {focused && (
                <div className="tile-strip scroll hidden-bar">
                  {tiles.filter((t) => t.key !== focused).map((t) => <TileView key={t.key} tile={t} small me={me} serverId={channel.server_id} onFocus={() => setVoice({ focused: t.key })} />)}
                </div>
              )}
              {stage && audience.length > 0 && (
                <div className="audience">
                  <div className="label">Audience — {audience.length}</div>
                  <div className="audience-grid">
                    {audience.map((p) => (
                      <div key={p.user_id} className="aud-member" onContextMenu={(e) => isMod && openMenu(e, [{ label: 'Invite to Speak', icon: <ArrowUpFromLine />, onClick: () => inviteToStage(p.user_id, true) }])}>
                        <Avatar userId={p.user_id} size={44} />
                        {p.hand && <span className="hand">✋</span>}
                        <NameTag userId={p.user_id} serverId={channel.server_id} className="tiny ellipsis" />
                        {isMod && p.hand && <button className="btn sm" onClick={() => inviteToStage(p.user_id, true)}>Invite up</button>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          {connected && (
            <div className="call-controls">
              <Tip label={v.localCamera ? 'Turn Off Camera' : 'Turn On Camera'}><button className={cn('cc-btn', v.localCamera && 'on')} disabled={!has(perms, P.VIDEO) || (stage && !v.speaker && !isMod)} onClick={() => void toggleCamera()}>{v.localCamera ? <Video /> : <VideoOff />}</button></Tip>
              <Tip label={v.localScreen ? 'Stop Streaming' : 'Share Your Screen'}><button className={cn('cc-btn', v.localScreen && 'on')} disabled={!has(perms, P.VIDEO) || (stage && !v.speaker && !isMod)} onClick={() => void toggleScreen()}>{v.localScreen ? <MonitorX /> : <MonitorUp />}</button></Tip>
              <Tip label={v.muted ? 'Unmute' : 'Mute'}><button className={cn('cc-btn', (v.muted || v.deafened) && 'off')} disabled={stage && !v.speaker && !isMod} onClick={toggleMute}>{v.muted || v.deafened ? <MicOff /> : <Mic />}</button></Tip>
              <Tip label={v.deafened ? 'Undeafen' : 'Deafen'}><button className={cn('cc-btn', v.deafened && 'off')} onClick={toggleDeafen}>{v.deafened ? <HeadphoneOff /> : <Headphones />}</button></Tip>
              {stage && !isMod && (v.speaker
                ? <Tip label="Move to audience"><button className="cc-btn" onClick={() => setSpeaker(false)}><ArrowDownToLine /></button></Tip>
                : <Tip label={v.hand ? 'Lower hand' : 'Request to speak'}><button className={cn('cc-btn', v.hand && 'on')} onClick={() => setHand(!v.hand)}><Hand /></button></Tip>)}
              {stage && isMod && !v.speaker && <Tip label="Become a speaker"><button className="cc-btn" onClick={() => setSpeaker(true)}><ArrowUpFromLine /></button></Tip>}
              <div className="cc-board">
                <Tip label="Soundboard"><button className={cn('cc-btn', board && 'on')} disabled={!has(perms, P.USE_SOUNDBOARD)} onClick={() => setBoard(!board)}><AudioLines /></button></Tip>
                <AnimatePresence>{board && <Soundboard onClose={() => setBoard(false)} serverId={channel.server_id} anchor="controls" />}</AnimatePresence>
              </div>
              <Tip label={full ? 'Exit Full Screen' : 'Full Screen'}><button className="cc-btn" onClick={fullscreen}>{full ? <Minimize2 /> : <Maximize2 />}</button></Tip>
              <Tip label="Disconnect"><button className="cc-btn leave" onClick={() => { void leaveVoice(); setUI({ voiceView: null }); }}><PhoneOff /></button></Tip>
            </div>
          )}
        </div>
        <AnimatePresence>
          {showChat && (
            <motion.aside className="voice-chat" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }}>
              <VoiceChat channelId={channelId} />
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StageBanner({ isMod }: { isMod: boolean }) {
  const hands = useVoice((s) => Object.values(s.participants).filter((p) => p.hand).length);
  return (
    <div className="stage-banner">
      <Radio size={16} /> <b>Stage</b> — speakers are on stage, everyone else listens.
      {isMod && hands > 0 && <span className="chip tiny">✋ {hands} want to speak</span>}
      <span className="spacer" />
      <Users size={14} />
    </div>
  );
}

function TileView({ tile, big, small, me, serverId, onFocus }: { tile: Tile; big?: boolean; small?: boolean; me: string; serverId: string | null; onFocus: () => void }) {
  const speaking = useVoice((s) => !!s.speaking[tile.userId]);
  const self = tile.userId === me;
  const p = tile.p;
  return (
    <motion.div
      layout
      className={cn('tile', speaking && tile.kind === 'user' && 'speaking', tile.kind === 'screen' && 'screen', big && 'big', small && 'small')}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      onClick={onFocus}
      onContextMenu={(e) => !self && openMenu(e, memberMenu(tile.userId, serverId))}
    >
      {tile.stream ? (
        <VideoEl stream={tile.stream} muted mirror={self && tile.kind === 'user'} contain={tile.kind === 'screen'} />
      ) : tile.kind === 'screen' ? (
        <div className="tile-wait"><span className="spinner" /> Loading stream…</div>
      ) : (
        <div className="tile-avatar">
          <TileBackdrop userId={tile.userId} />
          <motion.div animate={speaking ? { scale: [1, 1.06, 1] } : { scale: 1 }} transition={{ duration: 0.6, repeat: speaking ? Infinity : 0 }}>
            <Avatar userId={tile.userId} serverId={serverId} size={small ? 44 : big ? 120 : 84} speaking={speaking} />
          </motion.div>
        </div>
      )}
      <div className="tile-label">
        {tile.kind === 'screen' && <span className="live-tag">LIVE</span>}
        <NameTag userId={tile.userId} serverId={serverId} noEffect className="ellipsis" />
        {tile.kind === 'user' && p && (p.deafened ? <HeadphoneOff size={14} className="red" /> : p.muted ? <MicOff size={14} className="red" /> : null)}
      </div>
    </motion.div>
  );
}

function TileBackdrop({ userId }: { userId: string }) {
  const p = useData((s) => s.profiles[userId]);
  const theme = p?.neon === 'neon' && p.theme_colors?.length === 2 ? p.theme_colors : null;
  const bg = theme ? `linear-gradient(135deg, ${theme[0]}55, ${theme[1]}55)` : p?.banner_color ? `${p.banner_color}44` : undefined;
  return <div className="tile-bg" style={bg ? { background: bg } : undefined} />;
}

function VoiceChat({ channelId }: { channelId: string }) {
  useTypingChannel(channelId);
  useEffect(() => { void loadMessages(channelId); }, [channelId]);
  return (
    <div className="panel">
      <div className="panel-head"><MessageSquare size={18} /> Chat <span className="spacer" /><button className="icon-btn" onClick={() => setUI({ showVoiceChat: false })}>✕</button></div>
      <div className="thread-body">
        <MessageList channelId={channelId} compactTop />
        <Composer channelId={channelId} compact />
      </div>
    </div>
  );
}
