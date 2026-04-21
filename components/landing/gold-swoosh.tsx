export function GoldSwoosh({ flip = false }: { flip?: boolean }) {
  return (
    <div className={`pointer-events-none relative z-10 -my-6 w-full overflow-hidden ${flip ? "rotate-180" : ""}`}>
      <svg
        className="w-full block"
        viewBox="0 0 1440 48"
        fill="none"
        preserveAspectRatio="none"
        style={{ height: "48px" }}
      >
        <path
          d="M0 48 C360 8, 1080 8, 1440 48"
          stroke="url(#swoosh-gold)"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M0 48 C360 16, 1080 16, 1440 48"
          stroke="url(#swoosh-silver)"
          strokeWidth="1"
          fill="none"
          opacity="0.3"
        />
        <defs>
          <linearGradient id="swoosh-gold" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="oklch(0.76 0.14 80)" stopOpacity="0" />
            <stop offset="30%" stopColor="oklch(0.76 0.14 80)" stopOpacity="0.6" />
            <stop offset="50%" stopColor="oklch(0.82 0.12 70)" stopOpacity="0.8" />
            <stop offset="70%" stopColor="oklch(0.76 0.14 80)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="oklch(0.76 0.14 80)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="swoosh-silver" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="50%" stopColor="white" stopOpacity="0.5" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
