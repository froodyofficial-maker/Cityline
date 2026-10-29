import { create } from 'zustand';

export interface VoiceParticipant {
  user_id: string;
  muted: boolean;
  deafened: boolean;
  video: boolean;
  screen: boolean;
  streams: { mic?: string; camera?: string; screen?: string };
  hand?: boolean;      // stage: raised hand
  speaker?: boolean;   // stage: on stage
  joined_at: number;
}

export interface RemoteMedia { mic?: MediaStream; camera?: MediaStream; screen?: MediaStream }

export interface VoiceStore {
  channelId: string | null;
  serverId: string | null;
  status: 'idle' | 'connecting' | 'connected';
  muted: boolean;
  deafened: boolean;
  video: boolean;
  screen: boolean;
  speaking: Record<string, boolean>;
  remote: Record<string, RemoteMedia>;
  localCamera: MediaStream | null;
  localScreen: MediaStream | null;
  participants: Record<string, VoiceParticipant>;
  volumes: Record<string, number>;
  localMuted: Record<string, boolean>;
  peerState: Record<string, RTCPeerConnectionState>;
  noMic: boolean;
  hand: boolean;
  speaker: boolean;
  focused: string | null; // tile pinned in the grid ("userId:camera" / "userId:screen")
}

export const useVoice = create<VoiceStore>()(() => ({
  channelId: null,
  serverId: null,
  status: 'idle',
  muted: localStorage.getItem('cityline:muted') === '1',
  deafened: localStorage.getItem('cityline:deafened') === '1',
  video: false,
  screen: false,
  speaking: {},
  remote: {},
  localCamera: null,
  localScreen: null,
  participants: {},
  volumes: JSON.parse(localStorage.getItem('cityline:volumes') || '{}'),
  localMuted: {},
  peerState: {},
  noMic: false,
  hand: false,
  speaker: false,
  focused: null,
}));

export const voice = () => useVoice.getState();
export const setVoice = (p: Partial<VoiceStore> | ((s: VoiceStore) => Partial<VoiceStore>)) => useVoice.setState(p);
