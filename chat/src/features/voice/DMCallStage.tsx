import { motion } from 'motion/react';
import { HeadphoneOff, Headphones, Mic, MicOff, MonitorUp, MonitorX, Phone, PhoneOff, Video, VideoOff } from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar';
import { Tip } from '../../components/ui/Tooltip';
import { cn } from '../../lib/utils';
import { joinVoice, leaveVoice, toggleCamera, toggleDeafen, toggleMute, toggleScreen } from '../../lib/voice';
import { useData } from '../../store/data';
import { useVoiceMembers } from '../../store/selectors';
import { useVoice } from '../../store/voice';
import { VideoEl } from './VoiceView';
import { useShallow } from 'zustand/react/shallow';

/** Call area shown on top of a DM when a call is going on. */
export function DMCallStage({ channelId }: { channelId: string }) {
  const v = useVoice();
  const me = useData((s) => s.me!);
  const recipients = useData(useShallow((s) => s.channels[channelId]?.recipients ?? []));
  const inCall = v.channelId === channelId;
  const others = useVoiceMembers(channelId);
  const people = inCall ? Object.keys(v.participants) : others.map((o) => o.user_id);
  const waiting = inCall && people.length <= 1;
  return (
    <motion.div className="dm-call" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
      <div className="dm-call-tiles">
        {(inCall ? people : people).map((id) => {
          const cam = id === me ? v.localCamera : v.remote[id]?.camera;
          const scr = id === me ? v.localScreen : v.remote[id]?.screen;
          return (
            <div key={id} className={cn('dm-call-tile', v.speaking[id] && 'speaking')}>
              {scr ? <VideoEl stream={scr} muted contain /> : cam ? <VideoEl stream={cam} muted mirror={id === me} /> : <Avatar userId={id} size={80} speaking={!!v.speaking[id]} />}
            </div>
          );
        })}
        {waiting && recipients.filter((r) => r !== me).map((id) => (
          <div key={id} className="dm-call-tile ringing"><Avatar userId={id} size={80} /><span className="ring-wave" /></div>
        ))}
      </div>
      <div className="dm-call-status">{inCall ? (waiting ? 'Calling…' : `${people.length} in call`) : `${people.length} in call — join them!`}</div>
      <div className="call-controls small">
        {inCall ? (
          <>
            <Tip label="Camera"><button className={cn('cc-btn', v.localCamera && 'on')} onClick={() => void toggleCamera()}>{v.localCamera ? <Video /> : <VideoOff />}</button></Tip>
            <Tip label="Share screen"><button className={cn('cc-btn', v.localScreen && 'on')} onClick={() => void toggleScreen()}>{v.localScreen ? <MonitorX /> : <MonitorUp />}</button></Tip>
            <Tip label="Mute"><button className={cn('cc-btn', (v.muted || v.deafened) && 'off')} onClick={toggleMute}>{v.muted || v.deafened ? <MicOff /> : <Mic />}</button></Tip>
            <Tip label="Deafen"><button className={cn('cc-btn', v.deafened && 'off')} onClick={toggleDeafen}>{v.deafened ? <HeadphoneOff /> : <Headphones />}</button></Tip>
            <Tip label="Leave call"><button className="cc-btn leave" onClick={() => void leaveVoice()}><PhoneOff /></button></Tip>
          </>
        ) : (
          <button className="btn success" onClick={() => void joinVoice(channelId, null)}><Phone size={16} /> Join Call</button>
        )}
      </div>
    </motion.div>
  );
}
