// Cityline Neon — the premium tier. Everything cosmetic is defined here.
import type { NeonTier, Profile } from './types';

export const NEON = {
  name: 'Cityline Neon',
  lite: { name: 'Neon Lite', price: '$2.99' },
  full: { name: 'Neon', price: '$7.99' },
};

export interface Perk { icon: string; title: string; text: string; tier: 'lite' | 'neon'; isNew?: boolean }

export const PERKS: Perk[] = [
  { icon: '😜', title: 'Emoji everywhere', text: 'Use custom emoji from any server, anywhere — and animated emoji too.', tier: 'lite' },
  { icon: '💥', title: 'Super Reactions', text: 'Reactions that burst across the screen with animated emoji.', tier: 'lite' },
  { icon: '📎', title: 'Bigger uploads', text: 'Lite: 25 MB per file. Neon: 50 MB per file.', tier: 'lite' },
  { icon: '💎', title: 'Neon badge', text: 'A shimmering badge on your profile that shows how long you’ve been with us.', tier: 'lite' },
  { icon: '🚀', title: '2 Server Boosts', text: 'Unlock more emoji slots, banners, gradient role colours and more for servers you love.', tier: 'neon' },
  { icon: '🎨', title: 'Profile themes & banners', text: 'Two-colour gradient profiles, banners and animated avatars.', tier: 'neon' },
  { icon: '💫', title: 'Avatar decorations', text: 'Animated rings, halos, crowns and more around your avatar.', tier: 'neon' },
  { icon: '🌸', title: 'Profile effects', text: 'Petals, stars, embers and bubbles float over your profile card.', tier: 'neon' },
  { icon: '✨', title: 'Name styles', text: 'Aurora, sunset, glitch and glow effects on your display name.', tier: 'neon', isNew: true },
  { icon: '🎆', title: 'Message effects', text: 'Send a message with confetti, fireworks, hearts or snow that everyone sees.', tier: 'neon', isNew: true },
  { icon: '🖼️', title: 'Per-server avatars', text: 'A different look in every server.', tier: 'neon' },
  { icon: '✍️', title: 'Longer messages', text: 'Write up to 4,000 characters, and a 400 character About Me.', tier: 'neon' },
  { icon: '📺', title: 'HD video & streaming', text: 'Camera and screen share up to 1080p at 60 fps.', tier: 'neon' },
  { icon: '🌌', title: 'Exclusive app themes', text: 'Aurora, Sunset, Synthwave, Sakura, Ocean and Forest gradient themes.', tier: 'neon' },
  { icon: '🏰', title: 'Room for 200 servers', text: 'Join twice as many servers.', tier: 'neon' },
];

export const neonTier = (p?: Pick<Profile, 'neon'> | null): NeonTier => p?.neon ?? null;
export const isNeon = (p?: Pick<Profile, 'neon'> | null) => p?.neon === 'neon';
export const hasAnyNeon = (p?: Pick<Profile, 'neon'> | null) => !!p?.neon;

export interface Cosmetic { id: string; name: string; preview?: string }

export const DECORATIONS: Cosmetic[] = [
  { id: 'neon-ring', name: 'Neon Ring' },
  { id: 'aurora-halo', name: 'Aurora Halo' },
  { id: 'flames', name: 'Flames' },
  { id: 'crown', name: 'Crown' },
  { id: 'cat-ears', name: 'Cat Ears' },
  { id: 'orbit-hearts', name: 'Orbiting Hearts' },
  { id: 'pixel', name: 'Pixel Frame' },
  { id: 'sakura', name: 'Sakura Wreath' },
];

export const PROFILE_EFFECTS: Cosmetic[] = [
  { id: 'petals', name: 'Sakura Petals' },
  { id: 'stars', name: 'Starlight' },
  { id: 'embers', name: 'Embers' },
  { id: 'bubbles', name: 'Bubbles' },
  { id: 'cybergrid', name: 'Cyber Grid' },
  { id: 'snow', name: 'Snowfall' },
];

export const NAME_EFFECTS: Cosmetic[] = [
  { id: 'aurora', name: 'Aurora' },
  { id: 'sunset', name: 'Sunset' },
  { id: 'ocean', name: 'Ocean' },
  { id: 'rainbow', name: 'Rainbow' },
  { id: 'gold', name: 'Gold' },
  { id: 'glow', name: 'Neon Glow' },
  { id: 'glitch', name: 'Glitch' },
];

export const MESSAGE_EFFECTS: { id: string; name: string; emoji: string }[] = [
  { id: 'confetti', name: 'Confetti', emoji: '🎊' },
  { id: 'fireworks', name: 'Fireworks', emoji: '🎆' },
  { id: 'hearts', name: 'Hearts', emoji: '💖' },
  { id: 'snow', name: 'Snow', emoji: '❄️' },
  { id: 'stars', name: 'Shooting Stars', emoji: '🌠' },
  { id: 'bubbles', name: 'Bubbles', emoji: '🫧' },
];

export interface Theme { id: string; name: string; neon?: boolean; swatch: string[]; light?: boolean }

export const THEMES: Theme[] = [
  { id: 'midnight', name: 'Midnight', swatch: ['#0b0d14', '#151925', '#7c6cff'] },
  { id: 'slate', name: 'Slate', swatch: ['#1e1f22', '#313338', '#5865f2'] },
  { id: 'amoled', name: 'AMOLED', swatch: ['#000000', '#0a0a0a', '#7c6cff'] },
  { id: 'daylight', name: 'Daylight', swatch: ['#e9ebf3', '#ffffff', '#5b4cff'], light: true },
  { id: 'aurora', name: 'Aurora', neon: true, swatch: ['#06141b', '#0d2a2f', '#3dfbc0'] },
  { id: 'sunset', name: 'Sunset', neon: true, swatch: ['#1a0b14', '#2b1220', '#ff7a59'] },
  { id: 'synthwave', name: 'Synthwave', neon: true, swatch: ['#120a24', '#1d1036', '#ff3df0'] },
  { id: 'sakura', name: 'Sakura', neon: true, swatch: ['#1c1016', '#2a1820', '#ff8fb8'] },
  { id: 'ocean', name: 'Ocean', neon: true, swatch: ['#071423', '#0d2238', '#38b6ff'] },
  { id: 'forest', name: 'Forest', neon: true, swatch: ['#0b140d', '#132216', '#6fdc7a'] },
];

export const BOOST_LEVELS = [
  { level: 0, need: 0, perks: ['50 emoji slots'] },
  { level: 1, need: 2, perks: ['100 emoji slots', 'Animated server icon', 'Role icons', 'Animated emoji for everyone'] },
  { level: 2, need: 7, perks: ['150 emoji slots', 'Server banner', 'Gradient role colours', 'Bigger soundboard'] },
  { level: 3, need: 14, perks: ['250 emoji slots', 'Animated banner', 'Exclusive server badge', 'Bragging rights'] },
];

export function boostLevel(count = 0) {
  return count >= 14 ? 3 : count >= 7 ? 2 : count >= 2 ? 1 : 0;
}
