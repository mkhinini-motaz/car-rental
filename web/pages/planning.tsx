import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Button, Card, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Menu, MenuItem, Stack, TextField, Typography } from '@mui/material';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import { useAgency } from '../src/api/agency';
import { destroyBlock, planning, storeBlock } from '../src/api/car';
import { atTime } from '../src/classes/Agency';
import Car from '../src/classes/Car';
import CarBlock, { REASON_MAINTENANCE, REASONS } from '../src/classes/CarBlock';
import Contract, { STATUS_CLOSED, STATUS_OUT, STATUS_RESERVED, STATUS_RETURNED } from '../src/classes/Contract';
import { COLORS, ON_COLORS, tint, Tone } from '../src/constants';
import { useLang, useT } from '../src/store/Store';
import { arrow, formatDate, formatDateTime, plate } from '../src/support/utils';
import { useFeedback } from '../src/components/Feedback';
import { CarName } from '../src/components/car';
import { bareButton, Choice, DateTimeInput, Loading, Page } from '../src/components/common';
import { STATUS_TONES } from '../src/components/contract';

const DAY = 24 * 60 * 60;
const HOUR_MS = 60 * 60 * 1000;
const LABEL_WIDTH = 170;
const ROW_HEIGHT = 48;
const COLUMN = 44; // a day's narrowest: a finger's width; a week scrolls sideways on a small phone
const ZOOMS = { week: 7, month: 31 };

// The status badges' tones, as in the phone app. Overdue is striped too: not told by colour alone.
const STRIPES = 'repeating-linear-gradient(135deg, transparent 0 8px, rgb(0 0 0 / 0.2) 8px 16px)';

const midnight = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

// Takes a car off the planning (garage, the owner's own use) from the day clicked, 08:00 to 18:00
// by default. Bookings can't use those days; the API refuses a period already taken.
function BlockDialog({ car, day, onClose }: { car: Car, day: Date, onClose: () => void }) {
  const t = useT();
  const queryClient = useQueryClient();
  const { notify, requestError } = useFeedback();
  const [startsAt, setStartsAt] = useState(() => new Date(day.getTime() + 8 * HOUR_MS));
  const [endsAt, setEndsAt] = useState(() => new Date(day.getTime() + 18 * HOUR_MS));
  const [reason, setReason] = useState<number>(REASON_MAINTENANCE);
  const [note, setNote] = useState('');
  const save = useMutation({
    mutationFn: () => storeBlock(car.id, { starts_at: Math.floor(startsAt.getTime() / 1000), ends_at: Math.floor(endsAt.getTime() / 1000), reason: reason as 1, note: note.trim() || null }),
    onSuccess: () => {
      for (const key of [ 'planning', 'car.index.search', 'dashboard' ]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      onClose();
    },
    onError: requestError, // an overlap says the car is taken
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth='sm'>
      <DialogTitle>{t('block:new')}</DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 2.5, pt: 1 }}>
          <CarName data={car} withPlate />
          <DateTimeInput label='contract:starts_at' value={startsAt} onChange={setStartsAt} />
          <DateTimeInput label='contract:ends_at' value={endsAt} onChange={setEndsAt} min={startsAt} />
          <Choice label='block:reason' value={reason} onChange={setReason} options={REASONS.map(value => ({ label: 'block:reason:' + value, value }))} />
          <TextField label={t('contract:note')} value={note} onChange={event => setNote(event.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common:cancel')}</Button>
        <Button variant='contained' loading={save.isPending} onClick={() => endsAt > startsAt ? save.mutate() : notify('contract:dates:invalid', 'error')}>{t('common:save')}</Button>
      </DialogActions>
    </Dialog>
  );
}

// The paper planning board: one row per car, one column per day, contracts as bars coloured by
// status, blocks in dark grey. Click a bar to open it, an empty day to book or block the car.
export default function PlanningPage() {
  const t = useT();
  const { isRtl } = useLang();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { requestError } = useFeedback();
  const [zoom, setZoom] = useState<keyof typeof ZOOMS>('week');
  const [start, setStart] = useState(() => midnight(new Date()));
  const [dayMenu, setDayMenu] = useState<{ anchor: HTMLElement, car: Car, day: Date }|null>(null);
  const [blocking, setBlocking] = useState<{ car: Car, day: Date }|null>(null);
  const [openBlock, setOpenBlock] = useState<CarBlock|null>(null);
  const { data: agency } = useAgency();
  const days = ZOOMS[zoom];
  const from = start.getTime() / 1000;
  // Days are counted on the calendar, so a daylight-saving change doesn't shift the last one.
  const to = new Date(start.getFullYear(), start.getMonth(), start.getDate() + days).getTime() / 1000;
  const { isLoading, data } = useQuery({ queryKey: [ 'planning', { starts_at: from, ends_at: to } ], queryFn: planning });

  const removeBlock = useMutation({
    mutationFn: (block: CarBlock) => destroyBlock(block.car_id, block.id),
    onSuccess: () => {
      setOpenBlock(null);
      queryClient.invalidateQueries({ queryKey: ['planning'] });
      queryClient.invalidateQueries({ queryKey: ['car.index.search'] });
    },
    onError: requestError,
  });

  const shift = (count: number) => setStart(new Date(start.getFullYear(), start.getMonth(), start.getDate() + count));
  const dayAt = (index: number) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
  const percent = (timestamp: number) => (Math.min(Math.max(timestamp, from), to) - from) / (to - from) * 100;
  const now = Date.now() / 1000;
  const todayIndex = Math.floor((midnight(new Date()).getTime() / 1000 - from) / DAY);
  const isOverdue = (contract: Contract) => contract.status === STATUS_OUT && contract.ends_at < now;
  const period = (from: number, until: number) => formatDateTime(from) + arrow(isRtl) + formatDateTime(until);

  // Positions use inline `style`: the RTL stylesheet plugin would mirror `left` in Arabic. A contract
  // is a link to it, a block a button; `details` (status, dates) is for the tooltip and screen readers.
  const bar = (key: string, startsAt: number, endsAt: number, tone: Tone, isStriped: boolean, label: string, details: string, open: string|(() => void)) => {
    const left = percent(startsAt);
    const style: React.CSSProperties = {
      position: 'absolute', left: left + '%', width: `max(24px, ${percent(endsAt) - left}%)`, top: 8, bottom: 8, background: isStriped ? `${STRIPES}, ${COLORS[tone]}` : COLORS[tone], borderRadius: 6,
      color: ON_COLORS[tone], font: 'inherit', fontSize: 12, fontWeight: 600, padding: '0 6px', border: 0, display: 'flex', alignItems: 'center', overflow: 'hidden', whiteSpace: 'nowrap', cursor: 'pointer', textDecoration: 'none',
    };
    const name = label + ' · ' + details;
    return typeof open === 'string' ?
      <Link key={key} href={open} title={name} aria-label={name} style={style}>{label}</Link> :
      <button key={key} type='button' onClick={open} title={name} aria-label={name} style={style}>{label}</button>;
  };

  const legend: [string, string][] = [
    [ 'contract:status:' + STATUS_RESERVED, COLORS[STATUS_TONES[STATUS_RESERVED]] ],
    [ 'contract:status:' + STATUS_OUT, COLORS[STATUS_TONES[STATUS_OUT]] ],
    [ 'planning:overdue', `${STRIPES}, ${COLORS.danger}` ],
    [ 'contract:status:' + STATUS_RETURNED, COLORS[STATUS_TONES[STATUS_RETURNED]] ],
    [ 'contract:status:' + STATUS_CLOSED, COLORS[STATUS_TONES[STATUS_CLOSED]] ],
    [ 'planning:blocked', COLORS.muted ],
  ];
  const cellBorder = '1px solid ' + COLORS.line;

  return (
    <Page title='common:planning'>
      <Stack direction='row' sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 1 }}>
        <Stack direction='row' sx={{ alignItems: 'center' }}>
          <IconButton aria-label={t('common:previous')} onClick={() => shift(-days)}><ChevronLeft /></IconButton>
          <Button onClick={() => setStart(midnight(new Date()))}>{formatDate(from) + arrow(isRtl) + formatDate(to - 1)}</Button>
          <IconButton aria-label={t('common:next')} onClick={() => shift(days)}><ChevronRight /></IconButton>
        </Stack>
        <Choice value={zoom} onChange={setZoom} options={(Object.keys(ZOOMS) as (keyof typeof ZOOMS)[]).map(option => ({ label: 'planning:' + option, value: option }))} />
      </Stack>
      <Stack direction='row' sx={{ flexWrap: 'wrap', gap: 2, mb: 2 }}>
        {legend.map(([ label, colour ]) =>
          <Stack key={label} direction='row' sx={{ alignItems: 'center', gap: 0.75 }}>
            <Box style={{ background: colour }} sx={{ width: 12, height: 12, borderRadius: 0.5 }} />
            <Typography variant='body2'>{t(label)}</Typography>
          </Stack>
        )}
      </Stack>

      {isLoading || ! data ? <Loading /> :
        <Card dir='ltr' sx={{ display: 'flex' }}>
          <div style={{ width: `min(${LABEL_WIDTH}px, 26vw)`, flexShrink: 0, borderRight: cellBorder }}>
            <div style={{ height: 44 }} />
            {data.map(car =>
              <Link key={car.id} href={'/cars/' + car.id} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: ROW_HEIGHT, padding: '0 10px', borderTop: cellBorder, color: 'inherit', textDecoration: 'none' }}>
                <Typography variant='body2' noWrap sx={{ fontWeight: 600 }}>{car.manufacturer} {car.model_name}</Typography>
                <Typography variant='caption' noWrap color='text.secondary'>{plate(car.licence_plate)}</Typography>
              </Link>
            )}
          </div>
          <div style={{ overflowX: 'auto', flex: 1 }}>
            <div style={{ minWidth: days * COLUMN }}>
              <div style={{ display: 'flex', height: 44 }}>
                {Array.from({ length: days }, (_, index) =>
                  <div key={index} style={{ flex: 1, textAlign: 'center', paddingTop: 4, background: index === todayIndex ? tint('primary', 0.13) : undefined }}>
                    <Typography variant='caption' color='text.secondary' sx={{ display: 'block', lineHeight: 1.2 }}>{t('planning:weekday:' + dayAt(index).getDay())}</Typography>
                    <Typography variant='body2' sx={{ fontWeight: index === todayIndex ? 700 : 400 }}>{dayAt(index).getDate()}</Typography>
                  </div>
                )}
              </div>
              {data.map(car =>
                <div key={car.id} style={{ position: 'relative', height: ROW_HEIGHT, borderTop: cellBorder }}>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
                    {Array.from({ length: days }, (_, index) =>
                      <Box
                        key={index}
                        component='button'
                        type='button'
                        aria-label={car.manufacturer + ' ' + car.model_name + ' · ' + formatDate(dayAt(index).getTime() / 1000)}
                        onClick={event => setDayMenu({ anchor: event.currentTarget, car, day: dayAt(index) })}
                        style={{ background: index === todayIndex ? tint('primary', 0.07) : undefined }}
                        sx={{ ...bareButton, flex: 1, borderLeft: cellBorder, '&:hover, &:focus-visible': { outline: '2px solid', outlineColor: 'primary.light', outlineOffset: -2 } }}
                      />
                    )}
                  </div>
                  {car.contracts?.map(contract => bar(
                    'contract-' + contract.id,
                    contract.starts_at,
                    isOverdue(contract) ? now : contract.ends_at, // still out: up to now
                    isOverdue(contract) ? 'danger' : STATUS_TONES[contract.status],
                    isOverdue(contract),
                    contract.client ? contract.client.first_name + ' ' + contract.client.last_name : '',
                    t(isOverdue(contract) ? 'planning:overdue' : 'contract:status:' + contract.status) + ' · ' + period(contract.starts_at, contract.ends_at),
                    '/contracts/' + contract.id,
                  ))}
                  {car.blocks?.map(block => bar('block-' + block.id, block.starts_at, block.ends_at, 'muted', false, t('block:reason:' + block.reason), t('planning:blocked') + ' · ' + period(block.starts_at, block.ends_at), () => setOpenBlock(block)))}
                </div>
              )}
            </div>
          </div>
        </Card>
      }

      <Menu open={!! dayMenu} anchorEl={dayMenu?.anchor} onClose={() => setDayMenu(null)}>
        {dayMenu && <MenuItem disabled>{dayMenu.car.manufacturer} {dayMenu.car.model_name} · {formatDate(dayMenu.day.getTime() / 1000)}</MenuItem>}
        {/* From the agency's usual pickup time. */}
        <MenuItem onClick={() => { router.push(`/reservation?car=${dayMenu!.car.id}&startsAt=${atTime(dayMenu!.day, agency?.pickup_time ?? '10:00').getTime() / 1000}`); }}>{t('planning:reserve')}</MenuItem>
        <MenuItem onClick={() => { setBlocking({ car: dayMenu!.car, day: dayMenu!.day }); setDayMenu(null); }}>{t('block:new')}</MenuItem>
      </Menu>
      {blocking && <BlockDialog car={blocking.car} day={blocking.day} onClose={() => setBlocking(null)} />}
      <Dialog open={!! openBlock} onClose={() => setOpenBlock(null)}>
        <DialogTitle>{openBlock && t('block:reason:' + openBlock.reason)}</DialogTitle>
        <DialogContent>
          {openBlock && <Typography>{period(openBlock.starts_at, openBlock.ends_at)}</Typography>}
          {openBlock?.note && <Typography color='text.secondary'>{openBlock.note}</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenBlock(null)}>{t('common:close')}</Button>
          <Button color='error' variant='contained' loading={removeBlock.isPending} onClick={() => removeBlock.mutate(openBlock!)}>{t('block:delete')}</Button>
        </DialogActions>
      </Dialog>
    </Page>
  );
}
