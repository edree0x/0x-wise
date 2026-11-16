import type { ReactElement, SVGProps } from 'react'

export type IconName =
  | 'review'
  | 'library'
  | 'highlighter'
  | 'notes'
  | 'import'
  | 'plug'
  | 'settings'
  | 'search'
  | 'sun'
  | 'moon'
  | 'plus'
  | 'star'
  | 'starFilled'
  | 'trash'
  | 'close'
  | 'check'
  | 'left'
  | 'right'
  | 'down'
  | 'up'
  | 'download'
  | 'upload'
  | 'sparkle'
  | 'flame'
  | 'clock'
  | 'grid'
  | 'list'
  | 'tag'
  | 'link'
  | 'book'
  | 'sync'
  | 'menu'
  | 'quote'
  | 'eye'
  | 'lock'
  | 'pencil'
  | 'copy'
  | 'archive'
  | 'external'
  | 'chart'
  | 'leaf'
  | 'info'
  | 'listen'
  | 'rss'
  | 'play'
  | 'pause'
  | 'logout'

type IconProps = SVGProps<SVGSVGElement> & { name: IconName; size?: number }

const paths: Record<IconName, ReactElement> = {
  review: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v14H6.5A2.5 2.5 0 0 0 4 19.5v-14Z" />
      <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v14h5.5a2.5 2.5 0 0 1 2.5 2.5v-14Z" />
    </>
  ),
  library: (
    <>
      <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H9v18H5.5A1.5 1.5 0 0 1 4 19.5v-15Z" />
      <path d="M9 3h5.5A1.5 1.5 0 0 1 16 4.5v15a1.5 1.5 0 0 1-1.5 1.5H9" />
      <path d="m17.8 5.3 2.1-.6 3 15.6-2.1.6-3-15.6Z" />
    </>
  ),
  highlighter: (
    <>
      <path d="m9 15-4.5 4.5H2v-3L6.5 12" />
      <path d="m9 15 6.8-9.8a2 2 0 0 1 3.1-.3l.7.7a2 2 0 0 1-.2 3.1L9 15Z" />
      <path d="m6 12 6 6" />
    </>
  ),
  notes: (
    <>
      <path d="M5 3.5h9.5L19 8v12.5H5v-17Z" />
      <path d="M14 3.5V8h5" />
      <path d="M8 12h8M8 16h5" />
    </>
  ),
  import: (
    <>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V17" />
    </>
  ),
  plug: (
    <>
      <path d="M9 3v5M15 3v5" />
      <path d="M6 8h12v2a6 6 0 0 1-6 6 6 6 0 0 1-6-6V8Z" />
      <path d="M12 16v5" />
    </>
  ),
  settings: (
    <>
      <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h7M15 18h5" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="8" cy="12" r="2" />
      <circle cx="13" cy="18" r="2" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
  starFilled: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" fill="currentColor" />,
  trash: (
    <>
      <path d="M4 6h16M9 6V4h6v2M6 6l1 15h10l1-15" />
      <path d="M10 10v7M14 10v7" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  left: <path d="m15 5-7 7 7 7" />,
  right: <path d="m9 5 7 7-7 7" />,
  down: <path d="m5 9 7 7 7-7" />,
  up: <path d="m5 15 7-7 7 7" />,
  download: (
    <>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 18v2h16v-2" />
    </>
  ),
  upload: (
    <>
      <path d="M12 21V9" />
      <path d="m7 14 5-5 5 5" />
      <path d="M4 6V4h16v2" />
    </>
  ),
  sparkle: (
    <>
      <path d="m12 2 2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2L12 2Z" />
      <path d="M19 3v4M17 5h4" />
    </>
  ),
  flame: <path d="M12 22c4 0 7-2.8 7-6.6 0-3-1.8-5.5-4.2-7.9-.6 1.6-1.5 2.6-2.8 3.3.3-3.5-1-6-3.2-7.8.1 3.7-3.8 6.4-3.8 11.4C5 19 8 22 12 22Z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.5l3.5 2" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1" />
    </>
  ),
  list: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1" fill="currentColor" />
      <circle cx="4.5" cy="12" r="1" fill="currentColor" />
      <circle cx="4.5" cy="18" r="1" fill="currentColor" />
    </>
  ),
  tag: (
    <>
      <path d="M3 3h7.5L21 13.5 13.5 21 3 10.5V3Z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7L11.5 6.8" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1.5-1.5" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5Z" />
    </>
  ),
  sync: (
    <>
      <path d="M20 7h-5V2" />
      <path d="M19 7a8 8 0 0 0-13.4-2.5L4 6" />
      <path d="M4 17h5v5" />
      <path d="M5 17a8 8 0 0 0 13.4 2.5L20 18" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  quote: (
    <>
      <path d="M9 7H5.5A2.5 2.5 0 0 0 3 9.5v3A2.5 2.5 0 0 0 5.5 15H8v2H5" />
      <path d="M21 7h-3.5A2.5 2.5 0 0 0 15 9.5v3a2.5 2.5 0 0 0 2.5 2.5H20v2h-3" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 20h4L20 8l-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="13" rx="1.5" />
      <path d="M16 8V4.5A1.5 1.5 0 0 0 14.5 3h-10A1.5 1.5 0 0 0 3 4.5v10A1.5 1.5 0 0 0 4.5 16H8" />
    </>
  ),
  archive: (
    <>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v12h14V8M10 12h4" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6" />
      <path d="m20 4-9 9" />
      <path d="M18 14v5.5a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5v-13a.5.5 0 0 1 .5-.5H10" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  leaf: (
    <>
      <path d="M4 20c8 0 16-4 16-16-8 0-16 3-16 10 0 2.5 1 4 3 6" />
      <path d="M4 20c2-5 5-8 10-10" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
    </>
  ),
  listen: (
    <>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <path d="M4 14h2.5a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V14Z" />
      <path d="M20 14h-2.5a1 1 0 0 0-1 1v3.5a1 1 0 0 0 1 1H19a1 1 0 0 0 1-1V14Z" />
    </>
  ),
  rss: (
    <>
      <path d="M4 11a9 9 0 0 1 9 9" />
      <path d="M4 4a16 16 0 0 1 16 16" />
      <circle cx="4.5" cy="19.5" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  play: (
    <>
      <path d="M7 4.5v15l13-7.5-13-7.5Z" />
    </>
  ),
  pause: (
    <>
      <path d="M8 4.5v15M16 4.5v15" />
    </>
  ),
  logout: (
    <>
      <path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14" />
      <path d="M10 8l-4 4 4 4M6 12h10" />
    </>
  ),
}

export function Icon({ name, size = 20, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {paths[name]}
    </svg>
  )
}
