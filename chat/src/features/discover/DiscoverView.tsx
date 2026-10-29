import { motion } from 'motion/react';
import { Compass, Gamepad2, GraduationCap, Menu, Music, Palette, Search, Sparkles, Users, Code, Film } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ServerIcon } from '../../components/ui/Avatar';
import { cn, plural } from '../../lib/utils';
import { boostLevel } from '../../lib/neon';
import { discover, joinPublic } from '../../store/actions/servers';
import { navigate, setUI, toastError } from '../../store/ui';
import { firstTextChannel } from '../../store/selectors';

const CATS = [
  { id: null, label: 'Home', icon: <Compass size={18} /> },
  { id: 'gaming', label: 'Gaming', icon: <Gamepad2 size={18} /> },
  { id: 'music', label: 'Music', icon: <Music size={18} /> },
  { id: 'education', label: 'Education', icon: <GraduationCap size={18} /> },
  { id: 'art', label: 'Art & Design', icon: <Palette size={18} /> },
  { id: 'tech', label: 'Science & Tech', icon: <Code size={18} /> },
  { id: 'entertainment', label: 'Entertainment', icon: <Film size={18} /> },
  { id: 'community', label: 'Community', icon: <Users size={18} /> },
];

type Result = Awaited<ReturnType<typeof discover>>[number];

export function DiscoverView() {
  const [q, setQ] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [list, setList] = useState<Result[] | null>(null);
  useEffect(() => {
    setList(null);
    const t = setTimeout(() => void discover(q, tag).then(setList).catch(() => setList([])), 250);
    return () => clearTimeout(t);
  }, [q, tag]);
  return (
    <div className="discover scroll">
      <button className="icon-btn only-mobile discover-menu" onClick={() => setUI({ mobileNav: true })}><Menu /></button>
      <div className="discover-hero">
        <div className="hero-orbs"><i /><i /><i /></div>
        <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>Find your community on Cityline</motion.h1>
        <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>From gaming, to music, to learning, there’s a place for you.</motion.p>
        <motion.form className="discover-search" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} onSubmit={(e) => e.preventDefault()}>
          <input placeholder="Explore communities" value={q} onChange={(e) => setQ(e.target.value)} />
          <Search size={20} />
        </motion.form>
      </div>
      <div className="discover-cats">
        {CATS.map((c) => <button key={String(c.id)} className={cn('chip', tag === c.id && 'on')} onClick={() => setTag(c.id)}>{c.icon} {c.label}</button>)}
      </div>
      <h2 className="discover-h">{q ? `Results for “${q}”` : tag ? CATS.find((c) => c.id === tag)?.label : 'Featured communities'}</h2>
      <div className="discover-grid">
        {list === null && Array.from({ length: 6 }, (_, i) => <div key={i} className="server-card skeleton" style={{ height: 300 }} />)}
        {list?.map((s, i) => (
          <motion.div key={s.id} className="server-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} whileHover={{ y: -4 }}>
            <div className="sc-banner" style={s.banner_url ? { backgroundImage: `url(${s.banner_url})` } : { background: `linear-gradient(135deg, ${s.accent_color || '#7c6cff'}, #2fd0ff)` }} />
            <div className="sc-icon"><ServerIcon name={s.name} url={s.icon_url} size={56} /></div>
            <div className="sc-body">
              <div className="sc-name">{boostLevel(s.boost_count) >= 1 && <Sparkles size={14} className="neon-icon" />} {s.name}</div>
              <div className="sc-desc">{s.description || 'A Cityline community.'}</div>
              <div className="sc-meta">
                <span><i className="dot online" /> {plural(s.member_count, 'Member')}</span>
                {s.tags.slice(0, 2).map((t) => <span key={t} className="chip tiny">{t}</span>)}
              </div>
              <button className={cn('btn sm block', s.is_member && 'secondary')} onClick={() => (s.is_member ? navigate({ kind: 'server', serverId: s.id, channelId: firstTextChannel(s.id) }) : void joinPublic(s.id).catch(toastError))}>
                {s.is_member ? 'Open' : 'Join'}
              </button>
            </div>
          </motion.div>
        ))}
      </div>
      {list?.length === 0 && (
        <div className="empty">
          <div className="art">🔭</div>
          <h3>No public servers yet</h3>
          <p>Server owners can list their server here in Server Settings → Discovery.</p>
        </div>
      )}
    </div>
  );
}
