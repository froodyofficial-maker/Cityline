import { AnimatePresence, motion } from 'motion/react';
import { Check, Gem, Gift, Menu, Rocket, Sparkles, Zap, ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Avatar, Decoration, ServerIcon } from '../../components/ui/Avatar';
import { Spinner } from '../../components/ui/Controls';
import { DECORATIONS, NAME_EFFECTS, NEON, PERKS, PROFILE_EFFECTS } from '../../lib/neon';
import { cn, formatShortDate } from '../../lib/utils';
import { useData } from '../../store/data';
import { openModal, playEffect, setUI, toastError } from '../../store/ui';
import { redeemCode, startTrial } from '../../store/actions/users';
import { boostServer, removeBoost } from '../../store/actions/servers';
import { ProfileEffect } from '../profile/ProfileEffect';

export function NeonView() {
  const sub = useData((s) => s.neon);
  const active = !!sub && new Date(sub.expires_at) > new Date();
  const trialUsed = !!sub?.trial_used_at;
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const daysLeft = active ? Math.max(0, Math.ceil((new Date(sub!.expires_at).getTime() - Date.now()) / 86400000)) : 0;

  async function trial() {
    setBusy(true);
    try { await startTrial(); playEffect('confetti'); } catch (e) { toastError(e); }
    setBusy(false);
  }
  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    try { await redeemCode(code); setCode(''); playEffect('fireworks'); } catch (err) { toastError(err); }
    setBusy(false);
  }

  return (
    <div className="neon-page scroll">
      <button className="icon-btn only-mobile discover-menu" onClick={() => setUI({ mobileNav: true })}><Menu /></button>
      <section className="neon-hero">
        <div className="neon-sky" aria-hidden>
          {Array.from({ length: 28 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, animationDelay: `${(i % 7) * 0.6}s` }} />)}
        </div>
        <div className="neon-orb a" /><div className="neon-orb b" /><div className="neon-orb c" />
        <motion.div className="neon-hero-inner" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
          <motion.div className="neon-gem-big" animate={{ rotate: [0, 8, -8, 0], y: [0, -8, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}>
            <Gem size={56} />
          </motion.div>
          <h1 className="neon-title">Cityline <span className="neon-word">Neon</span></h1>
          <p className="neon-sub">Light up your profile, unlock HD streaming, bigger uploads, emoji everywhere, message effects and more.</p>
          {active ? (
            <div className="neon-status">
              <div className="neon-ring" style={{ '--p': `${Math.min(100, (daysLeft / 30) * 100)}%` } as React.CSSProperties}><span>{daysLeft}<small>days</small></span></div>
              <div>
                <div className="bold">You have {sub!.tier === 'neon' ? 'Neon' : 'Neon Lite'} ✨</div>
                <div className="muted small">{sub!.source === 'trial' ? 'Free trial' : 'Active'} until {formatShortDate(sub!.expires_at)}</div>
                <button className="btn sm secondary" style={{ marginTop: 8 }} onClick={() => openModal({ kind: 'userSettings', tab: 'profile' })}>Customize my profile</button>
              </div>
            </div>
          ) : (
            <div className="neon-ctas">
              {!trialUsed && <button className="btn lg neon" disabled={busy} onClick={() => void trial()}>{busy ? <Spinner /> : <><Sparkles size={18} /> Start 7-day free trial</>}</button>}
              <a className="btn lg outline" href="#neon-code">Redeem a gift code</a>
            </div>
          )}
        </motion.div>
      </section>

      <section className="neon-tiers">
        {[
          { id: 'lite', name: NEON.lite.name, price: NEON.lite.price, tagline: 'The essentials', perks: PERKS.filter((p) => p.tier === 'lite') },
          { id: 'neon', name: NEON.full.name, price: NEON.full.price, tagline: 'Everything, turned up', perks: PERKS },
        ].map((t, i) => (
          <motion.div key={t.id} className={cn('tier-card', t.id === 'neon' && 'full')} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} whileHover={{ y: -6 }}>
            {t.id === 'neon' && <div className="tier-pop">MOST POPULAR</div>}
            <div className="tier-head">
              <Gem size={22} />
              <div>
                <div className="tier-name">{t.name}</div>
                <div className="tier-tag">{t.tagline}</div>
              </div>
              <div className="tier-price">{t.price}<small>/month</small></div>
            </div>
            <ul className="tier-perks">
              {t.perks.slice(0, t.id === 'lite' ? 4 : 10).map((p) => <li key={p.title}><Check size={15} /> {p.title}{p.isNew && <span className="tag-new">NEW</span>}</li>)}
              {t.id === 'neon' && <li className="muted">…and {PERKS.length - 10} more</li>}
            </ul>
          </motion.div>
        ))}
      </section>

      <section className="neon-preview">
        <h2>See yourself in Neon</h2>
        <p className="muted">Avatar decorations, profile effects and name styles — live previews with your profile.</p>
        <CosmeticPreview />
      </section>

      <section className="neon-perks">
        <h2>Every perk</h2>
        <div className="perk-grid">
          {PERKS.map((p, i) => (
            <motion.div key={p.title} className="perk" initial={{ opacity: 0, y: 18, scale: 0.98 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, margin: '-40px' }} transition={{ delay: (i % 3) * 0.06 }}>
              <div className="perk-icon">{p.icon}</div>
              <div className="perk-title">{p.title} {p.isNew && <span className="tag-new">NEW</span>} {p.tier === 'lite' && <span className="chip tiny">Lite too</span>}</div>
              <div className="perk-text">{p.text}</div>
            </motion.div>
          ))}
        </div>
      </section>

      <BoostsSection active={active && sub?.tier === 'neon'} />

      <section className="neon-code" id="neon-code">
        <div className="code-card">
          <Gift size={28} />
          <div className="grow">
            <h3>Have a gift code?</h3>
            <p className="muted small">Codes look like <code>ABCD-EFGH-JKLM</code>. They stack — redeeming while subscribed adds time.</p>
          </div>
          <form onSubmit={redeem} className="row gap-8">
            <input className="input" placeholder="XXXX-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            <button className="btn" disabled={busy || !code}>Redeem</button>
          </form>
        </div>
      </section>

      <section className="neon-faq">
        <h2>Questions</h2>
        <Faq q="How do I get Neon?" a="Start the free 7-day trial, or redeem a gift code from the people who run this Cityline site. Site owners create codes in the Supabase SQL editor with select public.admin_create_neon_code('neon', 30); — or connect Stripe (see SUPABASE_SETUP.md)." />
        <Faq q="What happens when it ends?" a="You keep your account and messages. Neon-only cosmetics stop showing, and your boosts stop counting until you come back." />
        <Faq q="What are Server Boosts?" a="Every Neon member gets 2 boosts. Boosting a server unlocks perks for everyone in it: more emoji slots, a banner, gradient role colours and more." />
        <Faq q="Is Neon Lite different?" a="Lite covers the everyday perks: emoji anywhere, Super Reactions, bigger uploads and the badge. Neon adds profile customization, effects, HD streaming and boosts." />
      </section>
      <div style={{ height: 40 }} />
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn('faq', open && 'open')}>
      <button onClick={() => setOpen(!open)}>{q} <motion.span animate={{ rotate: open ? 180 : 0 }}><ChevronDown size={18} /></motion.span></button>
      <AnimatePresence initial={false}>
        {open && <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>{a}</motion.p>}
      </AnimatePresence>
    </div>
  );
}

function CosmeticPreview() {
  const me = useData((s) => (s.me ? s.profiles[s.me] : undefined));
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((n) => n + 1), 2600); return () => clearInterval(t); }, []);
  const deco = DECORATIONS[i % DECORATIONS.length];
  const fx = PROFILE_EFFECTS[i % PROFILE_EFFECTS.length];
  const name = NAME_EFFECTS[i % NAME_EFFECTS.length];
  const themes = [['#ff5fd2', '#2fd0ff'], ['#ff7a59', '#ffc35a'], ['#22d3a6', '#4f9dff'], ['#a76bff', '#ff5c7a']];
  const theme = themes[i % themes.length];
  if (!me) return null;
  return (
    <div className="cosmetic-preview">
      <motion.div className="profile-card popout themed preview" style={{ '--pt1': theme[0], '--pt2': theme[1] } as React.CSSProperties} layout>
        <ProfileEffect key={fx.id} id={fx.id} />
        <div className="pc-banner" style={{ background: `linear-gradient(135deg, ${theme[0]}, ${theme[1]})` }} />
        <div className="pc-avatar-row">
          <div className="avatar-preview">
            <Avatar userId={me.id} size={84} decoration={null} />
            <AnimatePresence mode="wait"><motion.span key={deco.id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }} className="deco-holder"><Decoration id={deco.id} /></motion.span></AnimatePresence>
          </div>
          <div className="pc-badges"><span className="pc-badge neon"><Gem size={14} /></span></div>
        </div>
        <div className="pc-body">
          <h2 className="pc-name"><span key={name.id} className={`name-tag name-fx name-fx-${name.id}`} data-text={me.display_name || me.username}>{me.display_name || me.username}</span></h2>
          <div className="pc-username">{me.username}</div>
          <div className="pc-section">
            <div className="pc-label">About Me</div>
            <div className="pc-bio">Living my best Neon life ✨</div>
          </div>
        </div>
      </motion.div>
      <div className="cosmetic-labels">
        <div><Zap size={14} /> Decoration: <b>{deco.name}</b></div>
        <div><Sparkles size={14} /> Profile effect: <b>{fx.name}</b></div>
        <div><Gem size={14} /> Name style: <b>{name.name}</b></div>
      </div>
    </div>
  );
}

function BoostsSection({ active }: { active: boolean }) {
  const boosts = useData((s) => s.myBoosts);
  const servers = useData((s) => s.servers);
  const [busy, setBusy] = useState<string | null>(null);
  const list = useMemo(() => Object.values(servers), [servers]);
  const slots = active ? 2 : 0;
  const used = boosts.length;
  return (
    <section className="neon-boosts">
      <h2><Rocket size={22} /> Server Boosts</h2>
      <p className="muted">Neon comes with 2 boosts. Boost a server to unlock perks for everyone in it.</p>
      <div className="boost-slots">
        {[0, 1].map((i) => {
          const b = boosts[i];
          const sv = b ? servers[b.server_id] : null;
          return (
            <motion.div key={i} className={cn('boost-slot', b && 'used')} layout>
              <Rocket size={20} />
              {b && sv ? (
                <>
                  <ServerIcon name={sv.name} url={sv.icon_url} size={28} />
                  <span className="ellipsis grow">{sv.name}</span>
                  <button className="btn sm secondary" disabled={busy === b.id} onClick={async () => { setBusy(b.id); try { await removeBoost(b.server_id); } catch (e) { toastError(e); } setBusy(null); }}>Remove</button>
                </>
              ) : <span className="muted grow">{i < slots ? 'Available boost' : 'Neon unlocks this boost'}</span>}
            </motion.div>
          );
        })}
      </div>
      {active && used < slots && (
        <div className="boost-pick">
          <div className="label">Boost a server</div>
          <div className="boost-servers">
            {list.map((sv) => (
              <button key={sv.id} className="boost-server" disabled={!!busy} onClick={async () => { setBusy(sv.id); try { await boostServer(sv.id); } catch (e) { toastError(e); } setBusy(null); }}>
                <ServerIcon name={sv.name} url={sv.icon_url} size={40} />
                <span className="ellipsis">{sv.name}</span>
                <span className="tiny muted">{sv.boost_count ?? 0} boosts</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
