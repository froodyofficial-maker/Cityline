# Cityline

A Discord-style chat site with its own premium tier, **Cityline Neon**. It's a static React site, and everything else (accounts, data, files, realtime) runs on [Supabase](https://supabase.com).

**To get it running, follow [SUPABASE_SETUP.md](SUPABASE_SETUP.md).** In short, create a Supabase project, run `supabase/schema.sql` in its SQL editor, then:

```bash
cd chat
npm install
cp .env.example .env      # paste in your project URL and anon key
npm run dev               # http://localhost:5173
```

## Features

**Servers and community**
- Servers from templates (Gaming, Friends, Study Group, Creators, Community), with icons, banners and descriptions
- Text, voice, stage, forum and announcement channels in collapsible, drag-to-reorder categories
- Roles with colours (gradient colours for boosted servers), Discord-style permission bitfields and per-channel overrides, all enforced by Row Level Security in the database
- Invite links with expiry and use limits, and joining straight from an invite during sign-up
- Kick, ban, timeout, nicknames, server avatars, an audit log and AutoMod (custom words, links, invites, mention spam, caps)
- Discover page for public servers, plus events and member levels

**Messaging**
- Markdown (bold, italics, underline, strikethrough, spoilers, quotes, headers, lists) and syntax-highlighted code blocks
- Replies, @mentions, role and @everyone mentions, edit (↑ to edit your last message), delete, pin, forward
- Reactions, Super Reactions, custom emoji, stickers and GIFs
- Threads, polls, voice messages, file and image uploads with drag-and-drop, and link embeds
- Typing indicators, unread markers and badges, an inbox of mentions, search, saved messages, reminders and scheduled messages
- Slash commands (`/poll`, `/shrug`, `/tableflip`, …) and a quick switcher (Ctrl/⌘ + K)

**People**
- Friends with requests, blocking, online status and custom status
- 1:1 and group DMs, with profile panels and mutual servers
- Profiles with bio, pronouns, banners and themes

**Voice and video**
- Voice channels with camera, screen share, mute, deafen, per-user volume and speaking indicators
- Stage channels with speakers, audience and raise-hand
- DM calls with ringing, and a soundboard

**Cityline Neon** (free 7-day trial, gift codes)
- *Neon Lite* ($2.99): emoji everywhere, Super Reactions, 25 MB uploads, a Neon badge
- *Neon* ($7.99): everything in Lite plus 50 MB uploads, 2 Server Boosts, profile themes and banners, animated avatar decorations, profile effects, animated name styles and full-screen message effects
- Server Boosts unlock levels at 2, 7 and 14 boosts

**Looks**
- Themes (Midnight, Slate, AMOLED, Daylight, plus Neon gradient themes), font scaling, compact mode and reduced motion
- Animations throughout, built with [Motion](https://motion.dev)
- Works on phones, with a slide-out server and channel drawer

## Project layout

```
chat/
├── SUPABASE_SETUP.md        step-by-step backend setup
├── supabase/
│   ├── schema.sql           tables, RLS, RPCs, storage, realtime (re-runnable)
│   └── functions/link-preview/   optional Edge Function for link cards
├── public/config.js         runtime config (edit after building, no rebuild needed)
└── src/
    ├── lib/                 Supabase client, permissions, markdown, voice (WebRTC), uploads…
    ├── store/               Zustand stores, realtime sync, actions
    ├── components/ui/       shared UI: avatars, modals, menus, tooltips, toasts
    ├── features/            screens: auth, chat, sidebar, voice, settings, Neon, friends…
    └── styles/              design tokens, themes and component styles
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Typecheck and build the static site into `dist/` |
| `npm run preview` | Serve the built site locally |
| `npm run typecheck` | Typecheck only |

Built with React 19, TypeScript, Vite, Zustand, Motion, lucide icons and supabase-js.
