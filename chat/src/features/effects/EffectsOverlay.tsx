import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useUI } from '../../store/ui';

// Canvas particle engine for Neon message effects. Each effect spawns
// particles for ~3s and lets them finish their motion.

interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; max: number;
  size: number; color: string; rot: number; vr: number; shape: 'rect' | 'circle' | 'heart' | 'star' | 'flake' | 'spark' | 'bubble';
  gravity: number; drag: number; trail?: { x: number; y: number }[];
}

const COLORS = ['#ff5fd2', '#8b7bff', '#2fd0ff', '#3dfbc0', '#ffd36b', '#ff7a59', '#ffffff'];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

function heart(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath();
  ctx.moveTo(0, s * 0.3);
  ctx.bezierCurveTo(0, 0, -s * 0.5, 0, -s * 0.5, s * 0.3);
  ctx.bezierCurveTo(-s * 0.5, s * 0.6, 0, s * 0.8, 0, s);
  ctx.bezierCurveTo(0, s * 0.8, s * 0.5, s * 0.6, s * 0.5, s * 0.3);
  ctx.bezierCurveTo(s * 0.5, 0, 0, 0, 0, s * 0.3);
  ctx.fill();
}
function star(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? s * 0.45 : s;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
}

class Engine {
  ctx: CanvasRenderingContext2D;
  parts: Particle[] = [];
  spawners: { effect: string; until: number; acc: number }[] = [];
  raf = 0;
  last = 0;
  w = 0; h = 0;
  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
  }
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth; this.h = window.innerHeight;
    this.canvas.width = this.w * dpr; this.canvas.height = this.h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  start(effect: string) {
    const until = performance.now() + (effect === 'fireworks' ? 3200 : 2600);
    this.spawners.push({ effect, until, acc: 0 });
    if (effect === 'confetti') this.burstConfetti();
    if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(this.tick); }
  }
  burstConfetti() {
    for (const side of [0, 1]) {
      for (let i = 0; i < 90; i++) {
        const a = side ? -Math.PI * (0.62 + Math.random() * 0.18) : -Math.PI * (0.2 + Math.random() * 0.18);
        const sp = 9 + Math.random() * 9;
        this.parts.push({ x: side ? this.w : 0, y: this.h * 0.75, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 220, size: 6 + Math.random() * 6, color: pick(COLORS), rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, shape: Math.random() < 0.7 ? 'rect' : 'circle', gravity: 0.22, drag: 0.985 });
      }
    }
  }
  spawn(effect: string, dt: number, sp: { acc: number }) {
    sp.acc += dt;
    const every = { confetti: 60, fireworks: 380, hearts: 70, snow: 35, stars: 160, bubbles: 90 }[effect] ?? 100;
    while (sp.acc > every) {
      sp.acc -= every;
      if (effect === 'confetti') {
        for (let i = 0; i < 4; i++) this.parts.push({ x: Math.random() * this.w, y: -20, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 2, life: 0, max: 400, size: 6 + Math.random() * 6, color: pick(COLORS), rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, shape: 'rect', gravity: 0.05, drag: 0.995 });
      } else if (effect === 'fireworks') {
        const cx = this.w * (0.15 + Math.random() * 0.7), cy = this.h * (0.15 + Math.random() * 0.4);
        const color = pick(COLORS);
        const n = 70 + Math.floor(Math.random() * 40);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const s = 3 + Math.random() * 4.5;
          this.parts.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 70 + Math.random() * 40, size: 2.2, color: Math.random() < 0.2 ? '#fff' : color, rot: 0, vr: 0, shape: 'spark', gravity: 0.05, drag: 0.965, trail: [] });
        }
      } else if (effect === 'hearts') {
        this.parts.push({ x: Math.random() * this.w, y: this.h + 20, vx: (Math.random() - 0.5) * 1.2, vy: -(2.5 + Math.random() * 2.5), life: 0, max: 360, size: 14 + Math.random() * 16, color: pick(['#ff5fd2', '#ff4d6d', '#ff8fb8', '#c084fc']), rot: (Math.random() - 0.5) * 0.6, vr: (Math.random() - 0.5) * 0.02, shape: 'heart', gravity: -0.01, drag: 0.998 });
      } else if (effect === 'snow') {
        this.parts.push({ x: Math.random() * this.w, y: -10, vx: (Math.random() - 0.5) * 0.8, vy: 1 + Math.random() * 1.6, life: 0, max: 600, size: 3 + Math.random() * 6, color: '#ffffff', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.04, shape: Math.random() < 0.3 ? 'flake' : 'circle', gravity: 0, drag: 1 });
      } else if (effect === 'stars') {
        const y = Math.random() * this.h * 0.5;
        this.parts.push({ x: -40, y, vx: 14 + Math.random() * 8, vy: 4 + Math.random() * 3, life: 0, max: 120, size: 8 + Math.random() * 6, color: pick(['#ffd36b', '#ffffff', '#2fd0ff']), rot: 0, vr: 0.1, shape: 'star', gravity: 0, drag: 1, trail: [] });
      } else if (effect === 'bubbles') {
        this.parts.push({ x: Math.random() * this.w, y: this.h + 30, vx: (Math.random() - 0.5) * 0.6, vy: -(1.2 + Math.random() * 1.8), life: 0, max: 600, size: 10 + Math.random() * 26, color: pick(['#2fd0ff', '#8b7bff', '#3dfbc0']), rot: Math.random() * 6, vr: 0.02, shape: 'bubble', gravity: -0.004, drag: 1 });
      }
    }
  }
  tick = (now: number) => {
    const dt = Math.min(50, now - this.last);
    this.last = now;
    const f = dt / 16.67;
    for (const sp of this.spawners) if (now < sp.until) this.spawn(sp.effect, dt, sp);
    this.spawners = this.spawners.filter((s) => now < s.until);
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    const keep: Particle[] = [];
    for (const p of this.parts) {
      p.life += f;
      p.vy += p.gravity * f;
      p.vx *= Math.pow(p.drag, f); p.vy *= Math.pow(p.drag, f);
      if (p.trail) { p.trail.push({ x: p.x, y: p.y }); if (p.trail.length > (p.shape === 'star' ? 14 : 6)) p.trail.shift(); }
      p.x += p.vx * f; p.y += p.vy * f; p.rot += p.vr * f;
      if (p.shape === 'flake' || (p.shape === 'circle' && p.gravity === 0)) p.x += Math.sin((p.life + p.size * 10) / 30) * 0.6;
      if (p.shape === 'bubble' || p.shape === 'heart') p.x += Math.sin(p.life / 25 + p.size) * 0.5;
      const alpha = Math.max(0, Math.min(1, (p.max - p.life) / 30));
      if (p.life > p.max || p.y > this.h + 60 || p.y < -80 || p.x < -80 || p.x > this.w + 80) continue;
      keep.push(p);
      ctx.save();
      ctx.globalAlpha = alpha;
      if (p.trail && p.trail.length > 1) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.shape === 'star' ? 2.5 : 1.6;
        ctx.globalAlpha = alpha * 0.5;
        ctx.beginPath();
        ctx.moveTo(p.trail[0].x, p.trail[0].y);
        for (const t of p.trail) ctx.lineTo(t.x, t.y);
        ctx.stroke();
        ctx.globalAlpha = alpha;
      }
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      switch (p.shape) {
        case 'rect': ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); break;
        case 'circle': ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill(); break;
        case 'heart': ctx.translate(0, -p.size / 2); heart(ctx, p.size); break;
        case 'star': ctx.shadowColor = p.color; ctx.shadowBlur = 12; star(ctx, p.size); break;
        case 'spark': ctx.shadowColor = p.color; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill(); break;
        case 'flake':
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4;
          for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(-p.size, 0); ctx.lineTo(p.size, 0); ctx.stroke(); }
          break;
        case 'bubble': {
          ctx.strokeStyle = p.color; ctx.lineWidth = 1.5; ctx.globalAlpha = alpha * 0.8;
          ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(-p.size / 6, -p.size / 6, p.size / 9, 0, Math.PI * 2); ctx.fill();
          break;
        }
      }
      ctx.restore();
    }
    this.parts = keep;
    if (this.parts.length || this.spawners.length) this.raf = requestAnimationFrame(this.tick);
    else { this.raf = 0; ctx.clearRect(0, 0, this.w, this.h); }
  };
  destroy() { cancelAnimationFrame(this.raf); }
}

export function EffectsOverlay() {
  const effects = useUI((s) => s.effects);
  const ref = useRef<HTMLCanvasElement>(null);
  const engine = useRef<Engine | null>(null);
  const seen = useRef(new Set<number>());
  useEffect(() => {
    if (!ref.current) return;
    engine.current = new Engine(ref.current);
    const onResize = () => engine.current?.resize();
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); engine.current?.destroy(); };
  }, []);
  useEffect(() => {
    if (document.documentElement.classList.contains('reduce-motion')) return;
    for (const e of effects) {
      if (seen.current.has(e.id)) continue;
      seen.current.add(e.id);
      engine.current?.start(e.effect);
    }
  }, [effects]);
  return createPortal(<canvas ref={ref} className="effects-canvas" aria-hidden />, document.body);
}
