# Supabase setup for Cityline

Everything Cityline stores lives in one Supabase project: accounts, servers, messages, files, presence, and the realtime events that make chat and voice live. Setup takes about 10 minutes. You never need to run a server of your own.

## 1. Create the project

1. Sign in at [supabase.com](https://supabase.com) and click **New project**.
2. Pick a name (for example `cityline`), a strong database password, and the region closest to your users.
3. Wait a minute or two while the project provisions.

The free plan is enough to run Cityline for a group of friends.

## 2. Run the schema

1. In the dashboard, open **SQL Editor** and click **New query**.
2. Open [`supabase/schema.sql`](supabase/schema.sql), copy **all** of it, paste it into the editor and click **Run**.
3. It should finish with `Success. No rows returned`.

That one script creates:

- every table (profiles, servers, channels, roles, messages, reactions, polls, threads, friends, DMs, Neon subscriptions, boosts and the rest);
- Row Level Security on every table, backed by a Discord-style permission engine (roles, channel overrides, timeouts and bans are enforced in the database, not just hidden in the UI);
- the RPC functions the app calls;
- the public `media` storage bucket (50 MB per file) with policies that only let people write inside their own folder;
- the realtime publication for live updates.

The script is safe to run again. When you update Cityline, re-run the newest `schema.sql` to pick up changes; your data is kept.

## 3. Configure authentication

Open **Authentication → URL Configuration**:

- **Site URL**: the address where you'll host the site, for example `https://cityline.example.com`. While developing, use `http://localhost:5173`.
- **Redirect URLs**: add the same address(es). Email confirmation, password reset and OAuth all send people back here.

Open **Authentication → Sign In / Providers → Email**:

- **Confirm email** on (the default): new users get a confirmation email and the app shows a "check your inbox" screen. If they registered from an invite link, they join that server automatically once they sign in.
- **Confirm email** off: registration signs people straight in. This is handy for testing.

> Supabase's built-in email sender is rate-limited (a few emails per hour) and meant for testing only. For real use, add your own SMTP server under **Authentication → Emails → SMTP Settings** (Resend, Postmark, SendGrid, Amazon SES and others all work).

### Optional: Google and GitHub sign-in

The login screen has Google and GitHub buttons. To make them work, enable each provider under **Authentication → Sign In / Providers** and paste in the client ID and secret from Google Cloud or GitHub. Each provider's page shows the callback URL to register with Google or GitHub. If you leave a provider off, its button shows a friendly error.

## 4. Connect the site to your project

Open **Project Settings → API** (or click **Connect** at the top of the dashboard) and copy:

- the **Project URL**, for example `https://abcdefghijklm.supabase.co`;
- the **anon** / **publishable** key.

> Never put the `service_role` / secret key in the site. It bypasses all security rules.

Then use **any one** of these options:

| Option | How | Good for |
| --- | --- | --- |
| `.env` file | Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The values are baked in at build time. | Local development and CI builds |
| `public/config.js` | Fill in `supabaseUrl` and `supabaseAnonKey`. In a built site this is `dist/config.js`, which you can edit without rebuilding. | Static hosting |
| Setup screen | Open the site without any config. It asks for the URL and key and saves them in that browser. | Quick tests |

## 5. Run it

```bash
cd chat
npm install
npm run dev
```

Open http://localhost:5173, register, and create your first server.

## 6. Deploy

```bash
npm run build
```

This produces a static `dist/` folder. Upload it to any static host. The app uses hash routes (`/#/channels/...`) and relative asset paths, so it needs no rewrite rules and works in a sub-folder too.

- **Netlify / Cloudflare Pages / Vercel**: set the build command to `npm run build`, the output directory to `dist` and the base directory to `chat`. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables (or fill in `public/config.js`).
- **GitHub Pages / any web server**: upload the contents of `dist/`.

Then go back to **Authentication → URL Configuration** and set the Site URL and Redirect URLs to your live address.

## 7. Cityline Neon (the premium tier)

Neon works out of the box: every account can start one free **7-day trial** from the Neon page. To give people longer access, run these in the **SQL Editor**. They're admin-only, so signed-in users can't call them from the app.

```sql
-- Gift code: tier ('neon' or 'lite'), days, number of uses, note
select public.admin_create_neon_code('neon', 30);           -- one 30-day Neon code
select public.admin_create_neon_code('lite', 365, 10, 'beta testers');

-- Grant Neon straight to someone by username
select public.admin_grant_neon(id, 'neon', 30) from public.profiles where username = 'alice';
```

People redeem codes on the Neon page (**Redeem a gift code**). Neon members get 2 Server Boosts each. Servers unlock perks at 2, 7 and 14 boosts.

**Selling Neon:** Cityline has no payment provider built in. To take real payments, create a Stripe Checkout or Payment Link and a small webhook (for example a Supabase Edge Function) that, on `checkout.session.completed`, connects with the service-role key and calls `public.admin_grant_neon(user_id, 'neon', 30)`. Pass the user's id to Stripe as `client_reference_id`.

## 8. Optional extras

### Link previews

Images, GIFs, videos and YouTube links preview with no setup. Preview cards for other websites (title, description, image) come from a small Edge Function in [`supabase/functions/link-preview`](supabase/functions/link-preview/index.ts):

```bash
npm install -g supabase          # or: brew install supabase/tap/supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase functions deploy link-preview
```

If it isn't deployed, links still work; they just don't get a card.

### GIF picker

Get a free API key at [developers.giphy.com](https://developers.giphy.com) and set `VITE_GIPHY_API_KEY` (or `giphyApiKey` in `config.js`).

### Voice and video through strict firewalls

Calls connect peer-to-peer using public STUN servers, which works on most home and mobile networks. Some corporate or school networks block that. For those, add a TURN server (for example from [Cloudflare Calls](https://developers.cloudflare.com/calls/turn/), [Metered](https://www.metered.ca/stun-turn) or a self-hosted [coturn](https://github.com/coturn/coturn)) and set `VITE_TURN_URL`, `VITE_TURN_USERNAME` and `VITE_TURN_CREDENTIAL`.

Voice uses a mesh, so every participant connects to every other one. It's best for rooms of up to about 8 people on camera, or more with audio only.

### Scheduled messages without anyone online

Scheduled messages are published by whichever Cityline tab is open, once a minute. To publish them even when nobody is online, enable the **pg_cron** extension (**Database → Extensions**) and run:

```sql
select cron.schedule('cityline-publish-scheduled', '* * * * *', $$select public.publish_due_messages()$$);
```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "Couldn’t load Cityline" when signing in | Check the URL and anon key. Make sure the project isn't paused (free projects pause after a week of inactivity; click **Restore** in the dashboard). |
| "The database isn’t set up yet", or `function ... does not exist` | `schema.sql` wasn't run, or didn't finish. Run it again. |
| Confirmation or reset emails never arrive | You've hit the built-in sender's rate limit. Set up custom SMTP (step 3). |
| Email links open `localhost` | Set the Site URL and Redirect URLs to your live address (step 3). |
| Messages only show after a refresh | Check **Database → Publications → supabase_realtime** includes the Cityline tables (`schema.sql` sets this up). |
| Voice connects but nobody can hear or see each other | One side is behind a strict firewall. Add a TURN server. |
| Uploads fail | Files are limited to 10 MB (25 MB Neon Lite, 50 MB Neon). Check the `media` bucket exists under **Storage**. |
