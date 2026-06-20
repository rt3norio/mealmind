// Line icons (24px, stroke = currentColor) — a single consistent set so the
// nav reads as a designed system, not a tray of emoji.
import type { ReactNode } from 'react';

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const IconToday = () => (
  <Svg>
    <rect x="3" y="4.5" width="18" height="16" rx="3" />
    <path d="M3 9.5h18" />
    <path d="M8 3v3M16 3v3" />
    <circle cx="12" cy="14.5" r="1.4" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconPlan = () => (
  <Svg>
    <rect x="5" y="4" width="14" height="17" rx="2.5" />
    <path d="M9.5 3.5h5a1 1 0 0 1 1 1V6a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" />
    <path d="M9 12h6M9 16h4" />
  </Svg>
);

export const IconDumbbell = () => (
  <Svg>
    <path d="M4 9.5v5M7 7.5v9M17 7.5v9M20 9.5v5M7 12h10" />
  </Svg>
);

export const IconTrend = () => (
  <Svg>
    <path d="M3 16.5l5.5-5.5 3.5 3 8-8" />
    <path d="M15 6h5v5" />
  </Svg>
);

export const IconMore = () => (
  <Svg>
    <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconData = () => (
  <Svg>
    <path d="M12 3.5v9.5M8.5 9.5l3.5 3.5 3.5-3.5" />
    <path d="M4.5 16.5v1.5a2.5 2.5 0 0 0 2.5 2.5h10a2.5 2.5 0 0 0 2.5-2.5v-1.5" />
  </Svg>
);

export const IconChat = () => (
  <Svg>
    <path d="M20.5 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 20.5 12z" />
  </Svg>
);

export const IconHelp = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9.4a2.4 2.4 0 1 1 3.4 2.2c-.8.4-1.1.9-1.1 1.7" />
    <circle cx="12" cy="16.4" r="0.5" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconSettings = () => (
  <Svg>
    <path d="M3.5 7.5h8M16.5 7.5h4M3.5 16.5h4M12.5 16.5h8" />
    <circle cx="14" cy="7.5" r="2.2" />
    <circle cx="9" cy="16.5" r="2.2" />
  </Svg>
);
