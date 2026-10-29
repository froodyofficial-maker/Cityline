export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="lm-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a08fff" />
          <stop offset="0.55" stopColor="#6a8cff" />
          <stop offset="1" stopColor="#2fd0ff" />
        </linearGradient>
      </defs>
      <path d="M10 48V31h8v17h5V20h9v28h5V26h8v22h5V35h6v13" fill="none" stroke="url(#lm-g)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="27.5" cy="11" r="3.4" fill="#2fd0ff">
        <animate attributeName="opacity" values="1;0.35;1" dur="2.4s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="logo">
      <LogoMark size={size} />
      <span className="logo-word" style={{ fontSize: size * 0.78 }}>Cityline</span>
    </span>
  );
}
