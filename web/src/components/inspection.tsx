import React, { useRef, useState } from 'react';
import { Box, Dialog, Stack, Typography } from '@mui/material';
import PhotoCamera from '@mui/icons-material/PhotoCamera';
import NoPhotography from '@mui/icons-material/NoPhotography';
import Contract from '../classes/Contract';
import { ANGLE_OTHER, ANGLES, ContractDamage, STAGE_PICKUP, STAGE_RETURN } from '../classes/Inspection';
import { COLORS, ON_COLORS, tint, Tone } from '../constants';
import { useT } from '../store/Store';
import { resizePhoto } from '../support/photo';
import { bareButton, Section, useMoney } from './common';

export interface DamageMark {
  x: number, // thousandths of the outline's width, from the left
  y: number, // thousandths of its height, from the top (the front of the car)
}

// Positions use inline `style`, not `sx`: the RTL stylesheet plugin would mirror `left` in Arabic.
const at = (left: string, top: string, extra: React.CSSProperties = {}): React.CSSProperties => ({ position: 'absolute', left, top, ...extra });

const STEP = 50; // an arrow key moves the keyboard marker by 5 % of the outline

// A car seen from above, front at the top. Clicking marks a damage where the pointer landed; from the
// keyboard, the arrows move a marker and Enter marks it. `older`: left from earlier rentals and not
// repaired (orange); `earlier`: marked at this rental's pickup (grey).
export function CarOutline({ older = [], earlier = [], marks, onMark }: { older?: DamageMark[], earlier?: DamageMark[], marks: DamageMark[], onMark?: (mark: DamageMark) => void }) {
  const t = useT();
  const [cursor, setCursor] = useState<DamageMark|null>(null); // shown while focused from the keyboard
  const onKeyDown = (event: React.KeyboardEvent) => {
    const move: Record<string, [number, number]> = { ArrowLeft: [ -STEP, 0 ], ArrowRight: [ STEP, 0 ], ArrowUp: [ 0, -STEP ], ArrowDown: [ 0, STEP ] };
    const current = cursor ?? { x: 500, y: 500 };
    if (move[event.key]) {
      event.preventDefault();
      const clamp = (value: number) => Math.min(1000, Math.max(0, value));
      setCursor({ x: clamp(current.x + move[event.key][0]), y: clamp(current.y + move[event.key][1]) });
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onMark!(current);
    }
  };
  const marker = (mark: DamageMark, tone: Tone, label: string, key: string) =>
    <div key={key} style={at(mark.x / 10 + '%', mark.y / 10 + '%', { width: 26, height: 26, marginLeft: -13, marginTop: -13, borderRadius: 13, background: COLORS[tone], color: ON_COLORS[tone], fontWeight: 700, fontSize: 13, display: 'grid', placeItems: 'center', pointerEvents: 'none' })}>{label}</div>;
  const wheel = (left: string, top: string) => <div key={left + top} style={at(left, top, { width: '12%', height: '14%', borderRadius: 6, background: COLORS.muted })} />;

  return (
    <div
      dir='ltr'
      onClick={onMark && (event => {
        const box = event.currentTarget.getBoundingClientRect();
        onMark({ x: Math.round((event.clientX - box.left) / box.width * 1000), y: Math.round((event.clientY - box.top) / box.height * 1000) });
      })}
      {...(onMark ? {
        tabIndex: 0,
        role: 'application',
        'aria-label': t('inspection:damages:keys'),
        onKeyDown,
        onFocus: (event: React.FocusEvent<HTMLDivElement>) => event.currentTarget.matches(':focus-visible') && setCursor(current => current ?? { x: 500, y: 500 }),
        onBlur: () => setCursor(null),
      } : {})}
      style={{ position: 'relative', width: '100%', maxWidth: 260, aspectRatio: '0.55', margin: '8px auto', cursor: onMark ? 'crosshair' : 'default', outline: cursor ? `2px solid ${COLORS.primary}` : 'none', outlineOffset: 6, borderRadius: 8 }}
    >
      {[ '4%', '84%' ].flatMap(left => [ '14%', '72%' ].map(top => wheel(left, top)))}
      <div style={at('12%', '0', { right: '12%', bottom: 0, border: `3px solid ${COLORS.primary}`, borderRadius: 60, background: COLORS.surface })}>
        <div style={at('12%', '22%', { right: '12%', height: '12%', borderRadius: 12, background: tint('info', 0.18), border: `2px solid ${COLORS.primary}` })} />
        <div style={at('16%', '36%', { right: '16%', bottom: '25%', borderRadius: 10, border: `2px solid ${tint('primary', 0.4)}` })} />
        <div style={at('12%', '77%', { right: '12%', height: '9%', borderRadius: 12, background: tint('info', 0.18), border: `2px solid ${COLORS.primary}` })} />
      </div>
      {older.map((mark, index) => marker(mark, 'warn', '•', 'older-' + index))}
      {earlier.map((mark, index) => marker(mark, 'muted', '•', 'earlier-' + index))}
      {marks.map((mark, index) => marker(mark, 'danger', String(index + 1), 'mark-' + index))}
      {cursor && <div style={at(cursor.x / 10 + '%', cursor.y / 10 + '%', { width: 30, height: 30, marginLeft: -15, marginTop: -15, borderRadius: 15, border: `3px solid ${COLORS.primary}`, boxShadow: `0 0 0 2px ${COLORS.surface}`, pointerEvents: 'none' })} />}
    </div>
  );
}

// One photo of the inspection. With `onPick`, an empty or filled box takes a new photo (the camera
// on a phone); otherwise clicking shows it full size. `label`: the angle, already translated.
export function PhotoBox({ url, label, caption, onPick, onOpen }: { url?: string|null, label: string, caption?: string, onPick?: (file: File) => void, onOpen?: () => void }) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const name = caption && t(caption) !== label ? label + ' · ' + t(caption) : label;
  const isClickable = !! (onPick || onOpen || url);

  return (
    <Box sx={{ width: { xs: 'calc(50% - 8px)', sm: 200 } }}>
      <Box
        {...(isClickable ? { component: 'button', type: 'button', 'aria-label': onPick ? t(url ? 'photo:choose' : 'inspection:photo:add') + ' · ' + name : name } : {})}
        onClick={() => onPick ? input.current?.click() : onOpen ? onOpen() : url && setIsOpen(true)}
        sx={{ ...(isClickable ? bareButton : {}), width: '100%', aspectRatio: '4 / 3', borderRadius: 2, overflow: 'hidden', bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', display: 'grid', placeItems: 'center' }}
      >
        {url ? <img src={url} alt={isClickable ? '' : name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : onPick ? <PhotoCamera color='action' fontSize='large' /> : <NoPhotography color='disabled' fontSize='large' />}
      </Box>
      {caption && <Typography variant='caption' color='text.secondary' sx={{ display: 'block', textAlign: 'center' }}>{t(caption)}</Typography>}
      {onPick && <input ref={input} type='file' accept='image/*' capture='environment' hidden onChange={async event => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) {
          onPick(await resizePhoto(file));
        }
      }} />}
      <Dialog open={isOpen} onClose={() => setIsOpen(false)} maxWidth='lg'>
        {url && <img src={url} alt={name} onClick={() => setIsOpen(false)} style={{ maxWidth: '100%', maxHeight: '90vh', display: 'block' }} />}
      </Dialog>
    </Box>
  );
}

// `amounts`: false for damages another client was charged for.
export function DamageList({ damages, amounts = true }: { damages: ContractDamage[], amounts?: boolean }) {
  const money = useMoney();
  return <>
    {damages.map((damage, index) =>
      <Stack key={damage.id} direction='row' sx={{ gap: 1 }}>
        <Typography sx={{ fontWeight: 700 }}>{index + 1}.</Typography>
        <Typography sx={{ flex: 1 }}>{damage.note || '—'}</Typography>
        {amounts && !! damage.amount && <Typography color='error' sx={{ fontWeight: 600 }}>{money(damage.amount)}</Typography>}
      </Stack>
    )}
  </>;
}

// Pickup and return side by side, angle by angle (click to compare large), then the damage marked at each.
export function InspectionSummary({ data }: { data: Contract }) {
  const t = useT();
  const [comparing, setComparing] = useState<number|null>(null);
  const photos = data.photos ?? [];
  const damages = data.damages ?? [];
  if (! photos.length && ! damages.length) {
    return null;
  }
  const photoAt = (stage: number, angle: number) => photos.find(photo => photo.stage === stage && photo.angle === angle)?.url;
  const extras = photos.filter(photo => photo.angle === ANGLE_OTHER);
  const pickupDamages = damages.filter(damage => damage.stage === STAGE_PICKUP);
  const returnDamages = damages.filter(damage => damage.stage === STAGE_RETURN);

  return (
    <Section title='inspection:label'>
      {ANGLES.filter(angle => photoAt(STAGE_PICKUP, angle) || photoAt(STAGE_RETURN, angle)).map(angle =>
        <Box key={angle}>
          <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{t('inspection:angle:' + angle)}</Typography>
          <Stack direction='row' sx={{ gap: 2 }}>
            <PhotoBox url={photoAt(STAGE_PICKUP, angle)} label={t('inspection:angle:' + angle)} caption='inspection:at_pickup' onOpen={() => setComparing(angle)} />
            <PhotoBox url={photoAt(STAGE_RETURN, angle)} label={t('inspection:angle:' + angle)} caption='inspection:at_return' onOpen={() => setComparing(angle)} />
          </Stack>
        </Box>
      )}
      {extras.length > 0 && <Box>
        <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{t('inspection:angle:7')}</Typography>
        <Stack direction='row' sx={{ gap: 2, flexWrap: 'wrap' }}>
          {extras.map(photo => <PhotoBox key={photo.id} url={photo.url} label={t('inspection:angle:7')} caption={photo.stage === STAGE_PICKUP ? 'inspection:at_pickup' : 'inspection:at_return'} />)}
        </Stack>
      </Box>}
      {pickupDamages.length > 0 && <Box>
        <Typography sx={{ fontWeight: 600 }}>{t('inspection:damages:pickup')}</Typography>
        <CarOutline marks={pickupDamages} />
        <DamageList damages={pickupDamages} />
      </Box>}
      {returnDamages.length > 0 && <Box>
        <Typography sx={{ fontWeight: 600 }}>{t('inspection:damages:return')}</Typography>
        <CarOutline earlier={pickupDamages} marks={returnDamages} />
        <DamageList damages={returnDamages} />
      </Box>}

      {/* The same angle before and after, as large as the screen allows, to show a client that a scratch is new. */}
      <Dialog open={comparing !== null} onClose={() => setComparing(null)} fullScreen>
        <Stack direction={{ xs: 'column', md: 'row' }} onClick={() => setComparing(null)} sx={{ bgcolor: 'black', height: '100%', gap: 1, p: 1, cursor: 'pointer' }}>
          {comparing !== null && [ [ STAGE_PICKUP, 'inspection:at_pickup' ], [ STAGE_RETURN, 'inspection:at_return' ] ].map(([ stage, caption ]) =>
            <Stack key={stage} sx={{ flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center' }}>
              {photoAt(stage as number, comparing) && <img src={photoAt(stage as number, comparing)} alt={t('inspection:angle:' + comparing) + ' · ' + t(caption as string)} style={{ maxWidth: '100%', maxHeight: '100%', minHeight: 0, objectFit: 'contain', flex: 1 }} />}
              <Typography sx={{ color: 'white' }}>{t(caption as string)}</Typography>
            </Stack>
          )}
        </Stack>
      </Dialog>
    </Section>
  );
}
