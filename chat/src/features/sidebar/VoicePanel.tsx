import { AnimatePresence, motion } from 'motion/react';
import { AudioLines, MonitorUp, MonitorX, PhoneOff, Signal, Video, VideoOff } from 'lucide-react';
import { useState } from 'react';
import { Tip } from '../../components/ui/Tooltip';
import { cn } from '../../lib/utils';
import { leaveVoice, toggleCamera, toggleScreen } from '../../lib/voice';
import { useData } from '../../store/data';
import { dmName } from '../../store/selectors';
import { navigate, setUI } from '../../store/ui';
import { useVoice } from '../../store/voice';
import { Soundboard } from '../voice/Soundboard';

export function VoicePanel() {
  const { channelId, serverId, status, localCamera, localScreen, peerState } = useVoice();
  const channel = useData((s) => (channelId ? s.channels[channelId] : undefined));
  const server = useData((s) => (serverId ? s.servers[serverId] : undefined));
  const dm = useData((s) => (channel && !channel.server_id ? dmName(channel, s) : null));
  const [board, setBoard] = useState(false);
  const states = Object.values(peerState);
  const bad = states.some((s) => s === 'failed' || s === 'disconnected');
  const connecting = status === 'connecting' || states.some((s) => s === 'connecting' || s === 'new');

  return (
    <AnimatePresence>
      {channelId && (
        <motion.div className="voice-panel" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
          <div className="voice-panel-top">
            <div className={cn('voice-conn', bad ? 'bad' : connecting ? 'wait' : 'ok')}>
              <Signal size={18} />
              <div>
                <div className="voice-conn-title">{status === 'connecting' ? 'Connecting…' : bad ? 'Connection trouble' : 'Voice Connected'}</div>
                <button
                  className="voice-conn-where ellipsis"
                  onClick={() => {
                    if (serverId && channelId) { navigate({ kind: 'server', serverId, channelId: null }); setUI({ voiceView: channelId }); }
                    else if (channelId) navigate({ kind: 'dm', channelId });
                  }}
                >
                  {channel ? (channel.server_id ? `${channel.name} / ${server?.name ?? ''}` : dm) : '…'}
                </button>
              </div>
            </div>
            <Tip label="Disconnect">
              <button className="icon-btn" onClick={() => { void leaveVoice(); setUI({ voiceView: null }); }} aria-label="Disconnect"><PhoneOff /></button>
            </Tip>
          </div>
          <div className="voice-panel-btns">
            <Tip label={localCamera ? 'Turn Off Camera' : 'Turn On Camera'}>
              <button className={cn('vp-btn', localCamera && 'on')} onClick={() => void toggleCamera()}>{localCamera ? <VideoOff size={18} /> : <Video size={18} />}</button>
            </Tip>
            <Tip label={localScreen ? 'Stop Streaming' : 'Share Your Screen'}>
              <button className={cn('vp-btn', localScreen && 'on')} onClick={() => void toggleScreen()}>{localScreen ? <MonitorX size={18} /> : <MonitorUp size={18} />}</button>
            </Tip>
            <Tip label="Soundboard">
              <button className={cn('vp-btn', board && 'on')} onClick={() => setBoard(!board)}><AudioLines size={18} /></button>
            </Tip>
          </div>
          <AnimatePresence>{board && <Soundboard onClose={() => setBoard(false)} serverId={serverId} anchor="panel" />}</AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
