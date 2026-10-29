import { MESSAGE_EFFECTS } from '../../lib/neon';

export interface SlashCommand { name: string; args?: string; description: string; neon?: boolean; server?: boolean }

export const COMMANDS: SlashCommand[] = [
  { name: 'shrug', args: '[message]', description: 'Appends ¯\\_(ツ)_/¯ to your message' },
  { name: 'tableflip', args: '[message]', description: 'Appends (╯°□°)╯︵ ┻━┻' },
  { name: 'unflip', args: '[message]', description: 'Appends ┬─┬ノ( º _ ºノ)' },
  { name: 'lenny', args: '[message]', description: 'Appends ( ͡° ͜ʖ ͡°)' },
  { name: 'me', args: '<action>', description: 'Sends your message as an action, in italics' },
  { name: 'spoiler', args: '<message>', description: 'Hides your message behind a spoiler' },
  { name: 'silent', args: '<message>', description: 'Sends without notifying anyone' },
  { name: 'poll', description: 'Create a poll' },
  { name: 'roll', args: '[sides]', description: 'Roll a die (default 6 sides)' },
  { name: 'flip', description: 'Flip a coin' },
  { name: '8ball', args: '<question>', description: 'Ask the magic 8-ball' },
  { name: 'nick', args: '<nickname>', description: 'Change your nickname in this server', server: true },
  { name: 'remind', args: '<10m|2h|1d> <note>', description: 'Get a reminder later' },
  { name: 'schedule', args: '<message>', description: 'Pick a time to send a message' },
  { name: 'catchup', description: 'See the best messages you missed in this server', server: true },
  ...MESSAGE_EFFECTS.map((e) => ({ name: e.id, args: '[message]', description: `${e.emoji} Send with a ${e.name.toLowerCase()} effect`, neon: true })),
];

const EIGHT_BALL = ['It is certain.', 'Without a doubt.', 'You may rely on it.', 'Yes, definitely.', 'Most likely.', 'Outlook good.', 'Signs point to yes.', 'Reply hazy, try again.', 'Ask again later.', 'Better not tell you now.', 'Cannot predict now.', 'Don’t count on it.', 'My reply is no.', 'My sources say no.', 'Outlook not so good.', 'Very doubtful.'];

export type CommandResult =
  | { kind: 'send'; content: string; effect?: string; silent?: boolean }
  | { kind: 'action'; action: 'poll' | 'catchup' | 'schedule' | 'nick' | 'remind'; arg: string }
  | { kind: 'error'; message: string }
  | null;

export function runCommand(text: string): CommandResult {
  const m = text.match(/^\/(\S+)\s*([\s\S]*)$/);
  if (!m) return null;
  const name = m[1].toLowerCase();
  const arg = m[2].trim();
  switch (name) {
    case 'shrug': return { kind: 'send', content: `${arg} ¯\\\\\\_(ツ)\\_/¯`.trim() };
    case 'tableflip': return { kind: 'send', content: `${arg} (╯°□°)╯︵ ┻━┻`.trim() };
    case 'unflip': return { kind: 'send', content: `${arg} ┬─┬ノ( º _ ºノ)`.trim() };
    case 'lenny': return { kind: 'send', content: `${arg} ( ͡° ͜ʖ ͡°)`.trim() };
    case 'me': return arg ? { kind: 'send', content: `_${arg}_` } : { kind: 'error', message: 'Usage: /me <action>' };
    case 'spoiler': return arg ? { kind: 'send', content: `||${arg}||` } : { kind: 'error', message: 'Usage: /spoiler <message>' };
    case 'silent': return arg ? { kind: 'send', content: arg, silent: true } : { kind: 'error', message: 'Usage: /silent <message>' };
    case 'roll': {
      const sides = Math.max(2, Math.min(1000, Number(arg) || 6));
      return { kind: 'send', content: `🎲 rolled a **${1 + Math.floor(Math.random() * sides)}** (d${sides})` };
    }
    case 'flip': return { kind: 'send', content: `🪙 flipped a coin: **${Math.random() < 0.5 ? 'Heads' : 'Tails'}**` };
    case '8ball': return arg ? { kind: 'send', content: `🎱 *${arg}*\n> **${EIGHT_BALL[Math.floor(Math.random() * EIGHT_BALL.length)]}**` } : { kind: 'error', message: 'Ask the 8-ball a question!' };
    case 'poll': return { kind: 'action', action: 'poll', arg };
    case 'catchup': return { kind: 'action', action: 'catchup', arg };
    case 'schedule': return { kind: 'action', action: 'schedule', arg };
    case 'nick': return { kind: 'action', action: 'nick', arg };
    case 'remind': return { kind: 'action', action: 'remind', arg };
    default: {
      const fx = MESSAGE_EFFECTS.find((e) => e.id === name);
      if (fx) return { kind: 'send', content: arg || fx.emoji, effect: fx.id };
      return { kind: 'error', message: `Unknown command /${name}` };
    }
  }
}

export function parseDuration(s: string): number | null {
  const m = s.match(/^(\d+)\s*(s|m|min|h|hr|d|w)$/i);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const mult = unit === 's' ? 1000 : unit.startsWith('m') ? 60_000 : unit.startsWith('h') ? 3600_000 : unit === 'd' ? 86_400_000 : 604_800_000;
  return n * mult;
}
