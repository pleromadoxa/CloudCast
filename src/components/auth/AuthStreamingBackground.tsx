/** Decorative live-broadcast pipeline animation for the auth page. */
export function AuthStreamingBackground() {
  return (
    <div className="auth-stream-bg" aria-hidden>
      <div className="auth-stream-vignette" />
      <div className="auth-stream-grid" />

      <div className="auth-stream-orb auth-stream-orb--red" />
      <div className="auth-stream-orb auth-stream-orb--green" />

      <svg
        className="auth-stream-scene"
        viewBox="0 0 1200 800"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="auth-pipe-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.15" />
            <stop offset="45%" stopColor="#e11d48" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.2" />
          </linearGradient>
          <filter id="auth-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ingest paths — cameras → server */}
        <path
          className="auth-stream-path auth-stream-path--a"
          d="M 120 280 C 280 280, 320 340, 480 380"
          stroke="url(#auth-pipe-grad)"
          strokeWidth="2"
        />
        <path
          className="auth-stream-path auth-stream-path--b"
          d="M 120 420 C 300 420, 340 400, 480 380"
          stroke="url(#auth-pipe-grad)"
          strokeWidth="2"
        />
        <path
          className="auth-stream-path auth-stream-path--c"
          d="M 120 520 C 320 500, 360 420, 480 380"
          stroke="url(#auth-pipe-grad)"
          strokeWidth="2"
        />

        {/* Egress paths — server → destinations */}
        <path
          className="auth-stream-path auth-stream-path--d"
          d="M 720 380 C 860 360, 920 280, 1080 240"
          stroke="url(#auth-pipe-grad)"
          strokeWidth="2"
        />
        <path
          className="auth-stream-path auth-stream-path--e"
          d="M 720 380 C 880 380, 940 400, 1080 400"
          stroke="url(#auth-pipe-grad)"
          strokeWidth="2"
        />
        <path
          className="auth-stream-path auth-stream-path--f"
          d="M 720 380 C 870 420, 930 500, 1080 540"
          stroke="url(#auth-pipe-grad)"
          strokeWidth="2"
        />

        {/* Camera nodes */}
        {[
          { cy: 280, delay: '0s' },
          { cy: 420, delay: '0.4s' },
          { cy: 520, delay: '0.8s' },
        ].map((node, i) => (
          <g key={`cam-${i}`} className="auth-stream-node" style={{ animationDelay: node.delay }}>
            <rect x="72" y={node.cy - 28} width="56" height="56" rx="8" className="auth-stream-node-box" />
            <circle cx="100" cy={node.cy - 8} r="10" className="auth-stream-node-lens" />
            <rect x="88" y={node.cy + 8} width="24" height="6" rx="2" className="auth-stream-node-detail" />
          </g>
        ))}

        {/* Broadcast server / encoder rack */}
        <g className="auth-stream-server" filter="url(#auth-glow)">
          <rect x="480" y="300" width="240" height="160" rx="12" className="auth-stream-server-body" />
          <rect x="500" y="320" width="200" height="88" rx="6" className="auth-stream-server-screen" />
          {/* VU bars on server screen */}
          {Array.from({ length: 16 }, (_, i) => (
            <rect
              key={i}
              x={512 + i * 11}
              y={360}
              width="6"
              height="36"
              rx="1"
              className="auth-stream-server-vu"
              style={{ animationDelay: `${i * 0.08}s` }}
            />
          ))}
          <text x="600" y="348" textAnchor="middle" className="auth-stream-server-label">
            PGM OUT
          </text>
          {/* Rack LEDs */}
          {Array.from({ length: 5 }, (_, i) => (
            <circle
              key={i}
              cx={510 + i * 18}
              cy={432}
              r="4"
              className="auth-stream-led"
              style={{ animationDelay: `${i * 0.3}s` }}
            />
          ))}
          <rect x="500" y="444" width="200" height="4" rx="2" className="auth-stream-server-slot" />
        </g>

        {/* Destination nodes */}
        {[
          { cy: 240, label: 'CDN', delay: '0.2s' },
          { cy: 400, label: 'LIVE', delay: '0.6s' },
          { cy: 540, label: 'SOCIAL', delay: '1s' },
        ].map((node, i) => (
          <g key={`dest-${i}`} className="auth-stream-node auth-stream-node--dest" style={{ animationDelay: node.delay }}>
            <circle cx="1080" cy={node.cy} r="36" className="auth-stream-dest-ring" />
            <circle cx="1080" cy={node.cy} r="22" className="auth-stream-dest-core" />
            <text x="1080" y={node.cy + 52} textAnchor="middle" className="auth-stream-dest-label">
              {node.label}
            </text>
          </g>
        ))}

        {/* Traveling signal packets */}
        {['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => (
          <circle
            key={id}
            r="5"
            className={`auth-stream-packet auth-stream-packet--${id}`}
            style={{ animationDelay: `${i * 0.55}s` }}
          />
        ))}
      </svg>

      {/* Broadcast rings from center */}
      <div className="auth-stream-rings">
        <span />
        <span />
        <span />
      </div>

      {/* Corner VU meters */}
      <div className="auth-stream-vu-rail auth-stream-vu-rail--left">
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} className="auth-stream-vu-bar" style={{ animationDelay: `${i * 0.07}s` }} />
        ))}
      </div>
      <div className="auth-stream-vu-rail auth-stream-vu-rail--right">
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} className="auth-stream-vu-bar" style={{ animationDelay: `${i * 0.09}s` }} />
        ))}
      </div>

      <div className="auth-stream-tagline">
        <span className="auth-stream-live-dot" />
        <span>Cloud broadcast pipeline</span>
      </div>
    </div>
  );
}
