// `php artisan serve` on this machine by default; set NEXT_PUBLIC_API_URL for anything else
// (it is compiled into the bundle at build time).
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/';
export const LOCAL = 'fr-TN'; // Tunisian grouping: 1 234,5 ('tn' is Tswana)
export const LOCAL_CURRENCY = 'TND';
export const PHONE_REGEX = /^(00|\+)2 *1 *6 *[234579] *([0-9] *){7}$/;
export type Tone = 'ok' | 'info' | 'warn' | 'danger' | 'muted' | 'primary' | 'ink';

// For `sx` and inline styles: the CSS variables MUI sets from the palette in theme.ts, so they
// follow light and dark; `tint(tone, opacity)` for a see-through wash of one.
const cssVar = (name: string) => `var(--mui-palette-${name})`;
const PALETTE_KEYS: Record<Tone, string> = { primary: 'primary', ok: 'success', info: 'info', warn: 'warning', danger: 'error', muted: 'muted', ink: 'ink' };
export const COLORS = {
  canvas: cssVar('background-default'), surface: cssVar('background-paper'), line: cssVar('divider'),
  ...Object.fromEntries(Object.entries(PALETTE_KEYS).map(([ tone, key ]) => [ tone, cssVar(key + '-main') ])) as Record<Tone, string>,
};
export const ON_COLORS = Object.fromEntries(Object.entries(PALETTE_KEYS).map(([ tone, key ]) => [ tone, cssVar(key + '-contrastText') ])) as Record<Tone, string>;
export const tint = (tone: Tone, opacity: number) => `rgb(${cssVar(PALETTE_KEYS[tone] + '-mainChannel')} / ${opacity})`;
