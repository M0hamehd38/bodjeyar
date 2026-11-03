import type { SVGProps } from 'react';

/**
 * آیکون‌های خطی رابط — SVG درون‌خطی، بدون کتابخانه‌ی خارجی.
 *
 * چرا نه یک پکیج آیکون: build روی VM سازمان بدون دسترسی پایدار به npm هم
 * باید انجام شود و چند آیکون ارزش یک وابستگی تازه را ندارد.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, ...rest }: IconProps, children: React.ReactNode) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const Icon = {
  home: (p: IconProps) =>
    base(p, <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />),
  pulse: (p: IconProps) => base(p, <path d="M3 12h4l3-8 4 16 3-8h4" />),
  chart: (p: IconProps) =>
    base(
      p,
      <>
        <path d="M3 3v18h18" />
        <path d="M7 15l4-4 3 3 5-6" />
      </>,
    ),
  file: (p: IconProps) =>
    base(
      p,
      <>
        <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" />
        <path d="M14 3v5h5M9 13h6M9 17h6" />
      </>,
    ),
  sparkles: (p: IconProps) =>
    base(
      p,
      <>
        <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
        <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
      </>,
    ),
  search: (p: IconProps) =>
    base(
      p,
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </>,
    ),
  chat: (p: IconProps) =>
    base(p, <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />),
  graph: (p: IconProps) =>
    base(
      p,
      <>
        <circle cx="6" cy="6" r="2.5" />
        <circle cx="18" cy="7" r="2.5" />
        <circle cx="12" cy="18" r="2.5" />
        <path d="M8.2 7.2 15.6 6.8M7.2 8.2l3.8 7.6M16.9 9.2l-3.7 6.6" />
      </>,
    ),
  calendar: (p: IconProps) =>
    base(
      p,
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </>,
    ),
  shield: (p: IconProps) =>
    base(
      p,
      <>
        <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />
        <path d="M12 8v4M12 16h.01" />
      </>,
    ),
  users: (p: IconProps) =>
    base(
      p,
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
        <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" />
      </>,
    ),
  car: (p: IconProps) =>
    base(
      p,
      <>
        <path d="M5 16h14M4 16l1.6-5.2A2 2 0 0 1 7.5 9.3h9a2 2 0 0 1 1.9 1.5L20 16v3h-2.5M4 16v3h2.5" />
        <circle cx="7.5" cy="16.5" r="1.5" />
        <circle cx="16.5" cy="16.5" r="1.5" />
      </>,
    ),
  inbox: (p: IconProps) =>
    base(
      p,
      <>
        <path d="M3 13h5l1.5 3h5L16 13h5" />
        <path d="M5.5 5h13L21 13v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z" />
      </>,
    ),
  bell: (p: IconProps) =>
    base(
      p,
      <>
        <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" />
        <path d="M10 21h4" />
      </>,
    ),
  menu: (p: IconProps) => base(p, <path d="M4 6h16M4 12h16M4 18h16" />),
  close: (p: IconProps) => base(p, <path d="M6 6l12 12M18 6 6 18" />),
  logout: (p: IconProps) =>
    base(
      p,
      <>
        <path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" />
        <path d="M10 8l-4 4 4 4M6 12h10" />
      </>,
    ),
  plus: (p: IconProps) => base(p, <path d="M12 5v14M5 12h14" />),
  arrowLeft: (p: IconProps) => base(p, <path d="M19 12H5M11 6l-6 6 6 6" />),
  alert: (p: IconProps) =>
    base(
      p,
      <>
        <path d="M12 3 2 20h20z" />
        <path d="M12 10v4M12 17h.01" />
      </>,
    ),
  check: (p: IconProps) => base(p, <path d="m5 12 5 5 9-10" />),
  clock: (p: IconProps) =>
    base(
      p,
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>,
    ),
  target: (p: IconProps) =>
    base(
      p,
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </>,
    ),
  download: (p: IconProps) => base(p, <path d="M12 4v11M7 10l5 5 5-5M4 20h16" />),
  printer: (p: IconProps) =>
    base(
      p,
      <>
        <path d="M7 9V3h10v6" />
        <rect x="3" y="9" width="18" height="8" rx="1.5" />
        <path d="M7 14h10v7H7z" />
      </>,
    ),
  refresh: (p: IconProps) =>
    base(
      p,
      <>
        <path d="M20 11a8 8 0 0 0-14.6-4.5L4 8" />
        <path d="M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16" />
        <path d="M20 20v-4h-4" />
      </>,
    ),
  user: (p: IconProps) =>
    base(
      p,
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>,
    ),
  mic: (p: IconProps) =>
    base(
      p,
      <>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
      </>,
    ),
  stop: (p: IconProps) => base(p, <rect x="6" y="6" width="12" height="12" rx="2" />),
  upload: (p: IconProps) => base(p, <path d="M12 20V9M7 14l5-5 5 5M4 4h16" />),
  grid: (p: IconProps) =>
    base(
      p,
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>,
    ),
  form: (p: IconProps) =>
    base(
      p,
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </>,
    ),
  edit: (p: IconProps) => base(p, <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />),
  trash: (p: IconProps) => base(p, <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />),
  arrowUp: (p: IconProps) => base(p, <path d="M12 19V5M6 11l6-6 6 6" />),
  arrowDown: (p: IconProps) => base(p, <path d="M12 5v14M6 13l6 6 6-6" />),
  message: (p: IconProps) => base(p, <path d="M4 5h16v11H9l-5 4zM8 9h8M8 12h5" />),
  folder: (p: IconProps) => base(p, <path d="M3 6h6l2 2h10v11H3z" />),
  mail: (p: IconProps) =>
    base(
      p,
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>,
    ),
  phone: (p: IconProps) =>
    base(
      p,
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />,
    ),
  phoneOff: (p: IconProps) =>
    base(
      p,
      <>
        <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
        <path d="M3 3l18 18" />
      </>,
    ),
  video: (p: IconProps) =>
    base(
      p,
      <>
        <rect x="3" y="6" width="13" height="12" rx="2" />
        <path d="m16 10 5-3v10l-5-3" />
      </>,
    ),
  videoOff: (p: IconProps) =>
    base(
      p,
      <>
        <rect x="3" y="6" width="13" height="12" rx="2" />
        <path d="m16 10 5-3v10l-5-3M3 3l18 18" />
      </>,
    ),
  micOff: (p: IconProps) =>
    base(
      p,
      <>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6M3 3l18 18" />
      </>,
    ),
  paperclip: (p: IconProps) =>
    base(
      p,
      <path d="m20 11-8.5 8.5a5 5 0 0 1-7-7L13 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L14 7" />,
    ),
  send: (p: IconProps) => base(p, <path d="M20 4 3 11l7 3 3 7zM10 14l4-4" />),
  reply: (p: IconProps) => base(p, <path d="M10 8 5 12l5 4M5 12h9a5 5 0 0 1 5 5v1" />),
  forward: (p: IconProps) => base(p, <path d="m14 8 5 4-5 4M19 12h-9a5 5 0 0 0-5 5v1" />),
  star: (p: IconProps) =>
    base(p, <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" />),
  archive: (p: IconProps) =>
    base(
      p,
      <>
        <rect x="3" y="4" width="18" height="4" rx="1" />
        <path d="M5 8v11h14V8M10 12h4" />
      </>,
    ),
  pin: (p: IconProps) => base(p, <path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7" />),
  more: (p: IconProps) =>
    base(
      p,
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>,
    ),
  kanban: (p: IconProps) =>
    base(
      p,
      <>
        <rect x="3" y="4" width="5" height="16" rx="1" />
        <rect x="10" y="4" width="5" height="10" rx="1" />
        <rect x="17" y="4" width="4" height="7" rx="1" />
      </>,
    ),
  list: (p: IconProps) => base(p, <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />),
  back: (p: IconProps) => base(p, <path d="m9 6 6 6-6 6" />),
  lock: (p: IconProps) =>
    base(
      p,
      <>
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </>,
    ),
  share: (p: IconProps) =>
    base(
      p,
      <>
        <circle cx="18" cy="5" r="2.5" />
        <circle cx="6" cy="12" r="2.5" />
        <circle cx="18" cy="19" r="2.5" />
        <path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" />
      </>,
    ),
  link: (p: IconProps) =>
    base(
      p,
      <>
        <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
        <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
      </>,
    ),
  location: (p: IconProps) =>
    base(
      p,
      <>
        <path d="M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21z" />
        <circle cx="12" cy="9.5" r="2.5" />
      </>,
    ),
  image: (p: IconProps) =>
    base(
      p,
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="8.5" cy="9.5" r="1.8" />
        <path d="m21 16-5-5-9 9" />
      </>,
    ),
  film: (p: IconProps) =>
    base(
      p,
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" />
      </>,
    ),
  headphones: (p: IconProps) =>
    base(
      p,
      <>
        <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
        <rect x="3" y="14" width="4" height="6" rx="1.5" />
        <rect x="17" y="14" width="4" height="6" rx="1.5" />
      </>,
    ),
  table: (p: IconProps) =>
    base(
      p,
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 10h18M3 15h18M9 4v16" />
      </>,
    ),
  pdf: (p: IconProps) =>
    base(
      p,
      <>
        <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" />
        <path d="M14 3v5h5" />
        <path d="M8 16h8M8 12.5h3" />
      </>,
    ),
  megaphone: (p: IconProps) =>
    base(
      p,
      <>
        <path d="M3 10v4a1 1 0 0 0 1 1h3l9 5V4L7 9H4a1 1 0 0 0-1 1z" />
        <path d="M19.5 9a4 4 0 0 1 0 6M7 15l1.5 5h2.5l-1-5" />
      </>,
    ),
  sun: (p: IconProps) =>
    base(
      p,
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>,
    ),
  moon: (p: IconProps) => base(p, <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />),
  medical: (p: IconProps) =>
    base(
      p,
      <>
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <path d="M12 8v8M8 12h8" />
      </>,
    ),
  building: (p: IconProps) =>
    base(
      p,
      <>
        <path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M3 21h18" />
        <path d="M8 8h3M8 12h3M8 16h3" />
      </>,
    ),
  heart: (p: IconProps) =>
    base(
      p,
      <path d="M12 20s-7.5-4.6-9-9.5C2 6.9 4.5 4 7.6 4c2 0 3.4 1.1 4.4 2.6C13 5.1 14.4 4 16.4 4 19.5 4 22 6.9 21 10.5 19.5 15.4 12 20 12 20z" />,
    ),
  thumbsUp: (p: IconProps) =>
    base(
      p,
      <>
        <path d="M7 10v10H4V10z" />
        <path d="M7 10l4-7c1.7 0 2.8 1.3 2.5 3L13 9h5.5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.3 20H7" />
      </>,
    ),
  smile: (p: IconProps) =>
    base(
      p,
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01" />
      </>,
    ),
  clap: (p: IconProps) =>
    base(
      p,
      <>
        <path d="M9 11 6.5 8.5a1.6 1.6 0 0 1 2.3-2.3L14 11.5M11.2 8.8 9.6 7.2a1.6 1.6 0 0 1 2.3-2.3l5.3 5.3c2.2 2.2 2.2 5.7 0 7.9a5.6 5.6 0 0 1-7.9 0L5.2 14a1.6 1.6 0 0 1 2.3-2.3L9 13.2" />
        <path d="M17 3.5 18 2M20 6.5l1.5-1" />
      </>,
    ),
  wow: (p: IconProps) =>
    base(
      p,
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="15" r="2" />
        <path d="M9 9.5h.01M15 9.5h.01" />
      </>,
    ),
  pray: (p: IconProps) =>
    base(
      p,
      <>
        <path d="M12 3v9l-3 3v6M12 12l3 3v6" />
        <path d="M12 3c-1.5 0-2.5 1-3 2.5L7 12l-2 3M12 3c1.5 0 2.5 1 3 2.5l2 6.5 2 3" />
      </>,
    ),
  pause: (p: IconProps) => base(p, <path d="M9 5v14M15 5v14" />),
  settings: (p: IconProps) =>
    base(
      p,
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </>,
    ),
  monitor: (p: IconProps) =>
    base(
      p,
      <>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </>,
    ),
  hourglass: (p: IconProps) =>
    base(p, <path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9" />),
  pen: (p: IconProps) =>
    base(
      p,
      <>
        <path d="M3 21c3-1 4-3 6-3s2 2 4 2 3-1 4-2" />
        <path d="M14.5 4.5 19.5 9.5 11 18l-5 1 1-5z" />
      </>,
    ),
  xCircle: (p: IconProps) =>
    base(
      p,
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m9 9 6 6M15 9l-6 6" />
      </>,
    ),
  checkCircle: (p: IconProps) =>
    base(
      p,
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 3 3 5-6" />
      </>,
    ),
  square: (p: IconProps) => base(p, <rect x="4" y="4" width="16" height="16" rx="3" />),
  checkSquare: (p: IconProps) =>
    base(
      p,
      <>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="m8 12 3 3 5-6" />
      </>,
    ),
  chevronDown: (p: IconProps) => base(p, <path d="m6 9 6 6 6-6" />),
  chevronLeft: (p: IconProps) => base(p, <path d="m15 6-6 6 6 6" />),
  undo: (p: IconProps) => base(p, <path d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" />),
} as const;

export type IconName = keyof typeof Icon;
