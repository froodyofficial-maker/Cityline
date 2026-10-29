import { memo, useMemo } from 'react';

// An animated night skyline drawn in SVG: three layers of buildings, lit
// windows that twinkle, a moon, drifting stars and traffic light trails.
function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

interface Building { x: number; w: number; h: number; windows: { x: number; y: number; d: number; on: boolean }[]; antenna: boolean }

function layer(seed: number, count: number, minH: number, maxH: number, width: number, win: boolean): Building[] {
  const r = rand(seed);
  const out: Building[] = [];
  let x = -20;
  for (let i = 0; i < count && x < width + 40; i++) {
    const w = 40 + r() * 90;
    const h = minH + r() * (maxH - minH);
    const windows: Building['windows'] = [];
    if (win) {
      for (let wy = 14; wy < h - 10; wy += 16) {
        for (let wx = 8; wx < w - 10; wx += 13) {
          if (r() > 0.42) windows.push({ x: x + wx, y: 600 - h + wy, d: r() * 8, on: r() > 0.25 });
        }
      }
    }
    out.push({ x, w, h, windows, antenna: r() > 0.75 });
    x += w + r() * 6;
  }
  return out;
}

export const Skyline = memo(function Skyline() {
  const W = 1600;
  const back = useMemo(() => layer(7, 40, 140, 330, W, false), []);
  const mid = useMemo(() => layer(19, 40, 110, 280, W, true), []);
  const front = useMemo(() => layer(31, 40, 60, 180, W, true), []);
  const stars = useMemo(() => {
    const r = rand(99);
    return Array.from({ length: 90 }, () => ({ x: r() * W, y: r() * 330, s: r() * 1.6 + 0.3, d: r() * 6 }));
  }, []);
  return (
    <div className="skyline" aria-hidden>
      <svg viewBox={`0 0 ${W} 600`} preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#070915" />
            <stop offset="0.55" stopColor="#1a1440" />
            <stop offset="0.85" stopColor="#4b1d5e" />
            <stop offset="1" stopColor="#ff6b8b" />
          </linearGradient>
          <radialGradient id="moonGlow">
            <stop offset="0" stopColor="#fff3d6" stopOpacity="0.9" />
            <stop offset="1" stopColor="#fff3d6" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="bBack" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#231a4a" />
            <stop offset="1" stopColor="#3a1f55" />
          </linearGradient>
          <linearGradient id="bMid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#14112e" />
            <stop offset="1" stopColor="#1d1338" />
          </linearGradient>
          <linearGradient id="bFront" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0b0a1c" />
            <stop offset="1" stopColor="#07060f" />
          </linearGradient>
        </defs>
        <rect width={W} height="600" fill="url(#sky)" />
        {stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#fff" className="sky-star" style={{ animationDelay: `${s.d}s` }} />
        ))}
        <circle cx="1240" cy="120" r="90" fill="url(#moonGlow)" />
        <circle cx="1240" cy="120" r="34" fill="#fff6df" />
        <circle cx="1254" cy="110" r="30" fill="#1a1440" opacity="0.18" />
        <g className="sky-layer back">
          {back.map((b, i) => <rect key={i} x={b.x} y={600 - b.h} width={b.w} height={b.h} fill="url(#bBack)" />)}
        </g>
        <g className="sky-layer mid">
          {mid.map((b, i) => (
            <g key={i}>
              <rect x={b.x} y={600 - b.h} width={b.w} height={b.h} fill="url(#bMid)" />
              {b.antenna && <line x1={b.x + b.w / 2} y1={600 - b.h} x2={b.x + b.w / 2} y2={600 - b.h - 28} stroke="#2a2250" strokeWidth="3" />}
              {b.antenna && <circle cx={b.x + b.w / 2} cy={600 - b.h - 30} r="3" fill="#ff4d6d" className="sky-beacon" />}
              {b.windows.map((w, j) => w.on && <rect key={j} x={w.x} y={w.y} width="6" height="8" rx="1" className="sky-window" style={{ animationDelay: `${w.d}s` }} />)}
            </g>
          ))}
        </g>
        <g className="sky-layer front">
          {front.map((b, i) => (
            <g key={i}>
              <rect x={b.x} y={600 - b.h} width={b.w} height={b.h} fill="url(#bFront)" />
              {b.windows.map((w, j) => w.on && <rect key={j} x={w.x} y={w.y} width="6" height="8" rx="1" className="sky-window warm" style={{ animationDelay: `${w.d}s` }} />)}
            </g>
          ))}
        </g>
        <g className="traffic">
          <rect x="-200" y="592" width="160" height="3" rx="2" className="trail red" />
          <rect x="-600" y="596" width="220" height="3" rx="2" className="trail white" />
          <rect x="-1100" y="592" width="120" height="3" rx="2" className="trail red slow" />
        </g>
      </svg>
      <div className="skyline-glow" />
    </div>
  );
});
