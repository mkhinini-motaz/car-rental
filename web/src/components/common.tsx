import React, { ReactNode, useEffect } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { Box, Button, Card, CardActionArea, CardContent, Chip, CircularProgress, Link, Stack, TextField, Typography } from '@mui/material';
import Client, { clientName } from '../classes/Client';
import { resizePhoto } from '../support/photo';
import { COLORS, ON_COLORS, Tone } from '../constants';
import { useLang, useT } from '../store/Store';
import { formatMoneyDisplay } from '../support/utils';
import { fromDateInput, toDateInput, toDateTimeInput } from '../support/day';

// A page's heading and its buttons; also names the browser tab.
export function Page({ title, titleText, actions, children }: { title?: string, titleText?: string, actions?: ReactNode, children: ReactNode }) {
  const t = useT();
  const heading = titleText ?? (title ? t(title) : '');
  useEffect(() => {
    document.title = heading ? heading + ' · Car rental' : 'Car rental';
  }, [heading]);

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: { xs: 2, md: 3 } }}>
      <Stack direction='row' sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        <Typography variant='h5' component='h1'>{heading}</Typography>
        {actions && <Stack direction='row' sx={{ gap: 1, flexWrap: 'wrap' }}>{actions}</Stack>}
      </Stack>
      {children}
    </Box>
  );
}

export function Section({ title, action, children, sx }: { title?: string, action?: ReactNode, children: ReactNode, sx?: object }) {
  const t = useT();
  return (
    <Card sx={{ mb: 2, ...sx }}>
      <CardContent>
        {(title || action) && <Stack direction='row' sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5, gap: 1 }}>
          {title && <Typography variant='h6'>{t(title)}</Typography>}
          {action}
        </Stack>}
        <Stack sx={{ gap: 1 }}>{children}</Stack>
      </CardContent>
    </Card>
  );
}

export function Loading() {
  return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>;
}

export function Empty({ text = 'common:no_data' }: { text?: string }) {
  return <Typography color='text.secondary' sx={{ textAlign: 'center', py: 3 }}>{useT()(text)}</Typography>;
}

// Millimes formatted in the selected language.
export function useMoney() {
  const { selectedLang } = useLang();
  return (millimes: number) => formatMoneyDisplay(millimes, selectedLang);
}

// A label and an amount on one line (totals, reports, the cash book).
export function Figure({ label, amount, color }: { label: string, amount: number, color?: string }) {
  const money = useMoney();
  return (
    <Stack direction='row' sx={{ justifyContent: 'space-between', gap: 2 }}>
      <Typography>{useT()(label)}</Typography>
      <Typography sx={{ fontWeight: 700, color, whiteSpace: 'nowrap' }}>{money(amount)}</Typography>
    </Stack>
  );
}

export interface ChoiceOption<V> { label: string, value: V, raw?: boolean }

// One choice among a few, as chips (the phone app's radio and chips fields). `raw` labels are shown as is.
export function Choice<V>({ label, value, onChange, options, error }: { label?: string, value: V, onChange: (value: V) => void, options: ChoiceOption<V>[], error?: boolean }) {
  const t = useT();
  return (
    <Box>
      {label && <Typography variant='subtitle2' color={error ? 'error' : 'text.secondary'} sx={{ mb: 0.75 }}>{t(label)}</Typography>}
      <Stack direction='row' sx={{ flexWrap: 'wrap', gap: 1 }}>
        {options.map(option =>
          <Chip
            key={String(option.value)}
            label={option.raw ? <bdi>{option.label}</bdi> : t(option.label)} // typed by people: a name keeps its own direction
            color={value === option.value ? 'primary' : 'default'}
            variant={value === option.value ? 'filled' : 'outlined'}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          />
        )}
      </Stack>
    </Box>
  );
}

// Native date and date-time pickers; `step` in minutes.
export function DateTimeInput({ label, value, onChange, step = 30, min, max }: { label: string, value: Date|null, onChange: (date: Date) => void, step?: number, min?: Date, max?: Date }) {
  return <TextField
    type='datetime-local'
    label={useT()(label)}
    value={toDateTimeInput(value)}
    onChange={event => { const date = fromDateInput(event.target.value); if (date) onChange(date); }}
    slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: step * 60, min: toDateTimeInput(min ?? null) || undefined, max: toDateTimeInput(max ?? null) || undefined } }}
  />;
}

export function DateInput({ label, value, onChange, max, required = false, error, helperText }: { label: string, value: Date|null, onChange: (date: Date|null) => void, max?: Date, required?: boolean, error?: boolean, helperText?: string }) {
  return <TextField
    type='date'
    label={useT()(label)}
    value={toDateInput(value)}
    onChange={event => onChange(fromDateInput(event.target.value))}
    required={required}
    error={error}
    helperText={helperText}
    slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: toDateInput(max ?? null) || undefined } }}
  />;
}

// A photo to upload: the current one (or the one just picked) and a button to choose another.
export function PhotoInput({ label, currentUrl, value, onChange }: { label: string, currentUrl?: string|null, value: File|null, onChange: (file: File) => void }) {
  const t = useT();
  const [preview, setPreview] = React.useState<string|null>(null);
  useEffect(() => {
    if (! value) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);
  const shown = preview ?? currentUrl;

  return (
    <Box>
      <Typography variant='subtitle2' color='text.secondary' sx={{ mb: 0.75 }}>{t(label)}</Typography>
      <Stack direction='row' sx={{ gap: 2, alignItems: 'center' }}>
        {shown && <img src={shown} alt='' style={{ width: 120, height: 90, objectFit: 'cover', borderRadius: 8 }} />}
        <Button variant='outlined' component='label'>
          {t('photo:choose')}
          <input type='file' accept='image/*' hidden onChange={async event => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) {
              onChange(await resizePhoto(file));
            }
          }} />
        </Button>
      </Stack>
    </Box>
  );
}

// For a `component='button'` that looks like what it wraps (a row, a swatch, a photo): reachable
// and usable from the keyboard, with a ring when focused that way.
export const bareButton = {
  p: 0, m: 0, border: 0, bgcolor: 'transparent', font: 'inherit', color: 'inherit', textAlign: 'start', cursor: 'pointer',
  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
};

// A status label in one of the phone app's tones (ok, info, warn, danger, muted, primary).
export function Badge({ label, params, tone = 'muted' }: { label: string, params?: Record<string, any>, tone?: Tone }) {
  return <Chip size='small' label={useT()(label, params)} sx={{ bgcolor: COLORS[tone], color: ON_COLORS[tone], fontWeight: 700, alignSelf: 'flex-start' }} />;
}

// A label and its value on one line (the phone app's InfoRow); with `href`, the value opens that page.
export function Info({ label, params, value, tone, bold = false, href }: { label: string, params?: Record<string, any>, value: ReactNode, tone?: Tone, bold?: boolean, href?: string }) {
  return (
    <Stack direction='row' sx={{ justifyContent: 'space-between', gap: 2, py: 0.25 }}>
      <Typography color='text.secondary'>{useT()(label, params)}</Typography>
      <Typography component='div' sx={{ fontWeight: bold ? 700 : 600, color: tone ? COLORS[tone] : undefined, textAlign: 'end' }}>{href ? <EntityLink href={href}>{value}</EntityLink> : value}</Typography>
    </Stack>
  );
}

// Opens a page on click, like a link, but may hold links of its own (a car or a client inside a
// contract card): an <a> can't. Ctrl/Cmd-click opens a new tab, as a link would.
export function OpenArea({ href, children, sx }: { href: string, children: ReactNode, sx?: object }) {
  const router = useRouter();
  return (
    <CardActionArea component='div' sx={sx} onClick={event => event.ctrlKey || event.metaKey ? window.open(href, '_blank') : router.push(href)}>
      {children}
    </CardActionArea>
  );
}

// A car, client, employee... named inside something clickable: opens its own page, not the outer one.
export function EntityLink({ href, children }: { href: string, children: ReactNode }) {
  const stop = (event: React.SyntheticEvent) => event.stopPropagation();
  return <Link component={NextLink} href={href} underline='hover' onClick={stop} onMouseDown={stop} sx={{ fontWeight: 600 }}>{children}</Link>;
}

export function ClientLink({ data }: { data: Client }) {
  return <EntityLink href={'/clients/' + data.id}>{clientName(data)}</EntityLink>;
}
