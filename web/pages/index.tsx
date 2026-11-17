import React, { ReactNode } from 'react';
import Link from 'next/link';
import { keyframes } from '@emotion/react';
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Stack, Typography } from '@mui/material';
import ArrowForward from '@mui/icons-material/ArrowForward';
import DirectionsCarOutlined from '@mui/icons-material/DirectionsCarOutlined';
import ExpandMore from '@mui/icons-material/ExpandMore';
import NotificationsOutlined from '@mui/icons-material/NotificationsOutlined';
import PhotoCameraOutlined from '@mui/icons-material/PhotoCameraOutlined';
import { Badge, useMoney } from '../src/components/common';
import { CarOutline } from '../src/components/inspection';
import { COLORS, tint, Tone } from '../src/constants';
import { LangSelect } from '../src/layout/Layout';
import { useLang, useStore, useT } from '../src/store/Store';
import { plate } from '../src/support/utils';

// The public home page: what the platform is, for agency owners arriving from a shared link, and
// the way in for staff. Every screen shown is the app's own look with example data.

const BRAND = 'Car rental'; // until the product has its name

// A notebook page is paper in light and dark alike, like the client's signature.
const PAPER = '#FFFDF6';
const RULE = '#C8D5EC';
const MARGIN = '#E08A8A';
const PEN = '#1D3A94';

// The pricing proposal, in millimes a month; the owner confirms it before launch.
const PLANS = [
  { id: 'free', cars: 4, staff: 1, branches: 1, month: 0 },
  { id: 'starter', cars: 10, staff: 2, branches: 1, month: 35000 },
  { id: 'agence', cars: 30, staff: 5, branches: 2, month: 70000 },
  { id: 'flotte', cars: 60, staff: 0, branches: 0, month: 110000 }, // 0: unlimited
];
const GROUP = { month: 110000, perCar: 1500 }; // above 60 cars, billed by the year

// The hero's day, once in the notebook and once in the app, line for line.
const DAY = [
  { car: 'VW Polo', plate: '198 تونس 6040', client: 'Leila Ben Salah', badge: 'landing:app:pickup', params: { time: '10:30' }, tone: 'ink' },
  { car: 'Hyundai i10', plate: '231 تونس 5512', client: 'Sami Gharbi', badge: 'landing:app:owes', params: { amount: 150000 }, tone: 'warn' },
  { car: 'Renault Clio 5', plate: '245 تونس 1234', client: 'Ahmed Trabelsi', badge: 'landing:app:return', params: { time: '17:00' }, tone: 'info' },
  { car: 'Hyundai Accent', plate: '250 تونس 3087', client: null, badge: 'landing:app:insurance', params: { days: 7 }, tone: 'warn' },
] as const;

// The one moment of motion: each notebook line is crossed out as its row lights up in the app.
// The end state is the resting state, so without motion (or before it) the page reads the same.
const strike = keyframes`from { background-size: 0% 2px; }`;
const light = keyframes`30% { background-color: var(--landing-light); }`;
const lineDelay = (index: number) => 0.6 + index * 0.45 + 's';
const motion = { '@media (prefers-reduced-motion: reduce)': { animation: 'none' } };

const onNav = 'nav.contrastText';
const wrap = { maxWidth: 1200, mx: 'auto', px: { xs: 2, md: 3 } };
const section = { py: { xs: 7, md: 11 } };
const figures = { fontVariantNumeric: 'tabular-nums' };

function StartButton({ onNavField = false }: { onNavField?: boolean }) {
  const t = useT();
  const { isRtl } = useLang();
  return (
    <Stack sx={{ gap: 1.25, alignItems: 'flex-start' }}>
      <Button
        component={Link}
        href='/signup'
        variant='contained'
        size='large'
        endIcon={<ArrowForward sx={{ transform: isRtl ? 'scaleX(-1)' : undefined }} />}
        sx={{ px: 3, py: 1.5, fontSize: '1rem', ...(onNavField ? { bgcolor: onNav, color: 'nav.main', '&:hover': { bgcolor: onNav, opacity: 0.92 } } : {}) }}
      >
        {t('landing:start')}
      </Button>
      <Typography variant='body2' sx={{ opacity: onNavField ? 0.85 : 1, color: onNavField ? undefined : 'text.secondary' }}>{t('landing:start:note')}</Typography>
    </Stack>
  );
}

// Lines on ruled paper, in pen, the margin on the side the language starts from. `struck`: crossed
// out one by one as the hero's app rows light up (a line that wraps is crossed out on each row).
function Notebook({ lines, heading, struck = false, tilt = -2, sx }: { lines: string[], heading?: string, struck?: boolean, tilt?: number, sx?: object }) {
  const { isRtl } = useLang();
  const start = isRtl ? '100%' : '0';
  return (
    <Box sx={{
      bgcolor: PAPER, color: PEN, borderRadius: 2.5, transform: `rotate(${isRtl ? -tilt : tilt}deg)`,
      backgroundImage: `linear-gradient(${isRtl ? 270 : 90}deg, transparent 38px, ${MARGIN} 38px, ${MARGIN} 40px, transparent 40px), repeating-linear-gradient(transparent 0 31px, ${RULE} 31px 32px)`,
      backgroundPosition: '0 0, 0 12px', pt: '12px', pb: 2, paddingInlineStart: '54px', paddingInlineEnd: '20px', ...sx,
    }}>
      {heading && <Typography sx={{ lineHeight: '32px', fontWeight: 700, fontStyle: 'italic', color: PEN }}>{heading}</Typography>}
      {lines.map((line, index) =>
        <Typography key={index} sx={{ lineHeight: '32px', fontStyle: 'italic', fontSize: '1rem', color: PEN }}>
          <Box component='span' sx={struck ? {
            backgroundImage: `linear-gradient(${PEN}, ${PEN})`, backgroundRepeat: 'no-repeat', backgroundPosition: `${start} 58%`, backgroundSize: '100% 2px',
            boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone', animation: `${strike} 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${lineDelay(index)} backwards`, ...motion,
          } : {}}>{line}</Box>
        </Typography>
      )}
    </Box>
  );
}

// An app screen: a card as in the staff app, with its title bar.
function Screen({ title, icon, children, sx }: { title: string, icon?: ReactNode, children: ReactNode, sx?: object }) {
  return (
    <Box sx={{ bgcolor: 'background.paper', color: 'text.primary', border: '1px solid', borderColor: 'divider', borderRadius: 2.5, overflow: 'hidden', ...sx }}>
      <Stack direction='row' sx={{ alignItems: 'center', gap: 1, px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
        {icon}
        <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
      </Stack>
      <Box sx={{ px: 2, py: 1 }}>{children}</Box>
    </Box>
  );
}

function Row({ title, detail, end, sx }: { title: ReactNode, detail?: ReactNode, end?: ReactNode, sx?: object }) {
  return (
    <Stack direction='row' sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1.5, py: 1, borderRadius: 1.5, mx: -1, px: 1, ...sx }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600, lineHeight: 1.3 }}>{title}</Typography>
        {detail && <Typography variant='caption' color='text.secondary' sx={{ display: 'block' }}>{detail}</Typography>}
      </Box>
      {end}
    </Stack>
  );
}

// The same day as the notebook, on the app's Today screen.
function TodayScreen() {
  const t = useT();
  const money = useMoney();
  return (
    <Screen title={t('common:today')}>
      {DAY.map((row, index) =>
        <Row
          key={row.car}
          title={row.car}
          detail={<>{plate(row.plate)}{row.client && <> · <bdi>{row.client}</bdi></>}</>}
          end={<Badge label={row.badge} params={'amount' in row.params ? { amount: money(row.params.amount) } : row.params} tone={row.tone as Tone} />}
          sx={{ '--landing-light': tint('primary', 0.16), animation: `${light} 1.4s ease-out ${lineDelay(index)}`, ...motion }}
        />
      )}
    </Screen>
  );
}

function Hero() {
  const t = useT();
  return (
    <Box sx={{ ...wrap, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '5fr 6fr' }, gap: { xs: 5, md: 6 }, alignItems: 'center', pt: { xs: 4, md: 8 }, pb: { xs: 7, md: 12 } }}>
      <Stack sx={{ gap: 3 }}>
        <Typography variant='h1' sx={{ fontSize: { xs: '2.25rem', sm: '2.75rem', md: '3.5rem' }, fontWeight: 700, lineHeight: 1.08, letterSpacing: '-0.02em', textWrap: 'balance' }}>
          {t('landing:hero:title')}
        </Typography>
        <Typography sx={{ fontSize: { xs: '1.0625rem', md: '1.1875rem' }, opacity: 0.88, maxWidth: '34em' }}>{t('landing:hero:text')}</Typography>
        <StartButton onNavField />
      </Stack>
      <Stack role='img' aria-label={t('landing:hero:visual')} sx={{ maxWidth: 580, width: '100%', justifySelf: { md: 'end' } }}>
        <Box sx={{ width: '88%', alignSelf: 'flex-start' }}>
          <Notebook heading={t('landing:notebook:day')} lines={[ 1, 2, 3, 4 ].map(line => t('landing:notebook:' + line))} struck sx={{ pb: 5 }} />
        </Box>
        <Box sx={{ width: '88%', alignSelf: 'flex-end', mt: -3, position: 'relative' }}>
          <TodayScreen />
          <Typography variant='caption' sx={{ display: 'block', textAlign: 'end', mt: 1, opacity: 0.8 }}>{t('landing:example')}</Typography>
        </Box>
      </Stack>
    </Box>
  );
}

// One promise: the paper habit it ends, beside the app screen that replaces it.
function Pillar({ name, paper, reverse = false, children }: { name: string, paper: string[], reverse?: boolean, children: ReactNode }) {
  const t = useT();
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: { xs: 4, md: 8 }, alignItems: 'center' }}>
      <Stack sx={{ gap: 2, order: { md: reverse ? 2 : 1 } }}>
        <Typography variant='h2' sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' }, fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.01em', textWrap: 'balance' }}>{t(`landing:${name}:title`)}</Typography>
        <Typography sx={{ fontSize: '1rem', color: 'text.secondary', maxWidth: '32em' }}>{t(`landing:${name}:text`)}</Typography>
      </Stack>
      <Stack role='img' aria-label={t(`landing:${name}:visual`)} sx={{ order: { md: reverse ? 1 : 2 }, maxWidth: 480, width: '100%', justifySelf: { md: reverse ? 'start' : 'end' } }}>
        <Box sx={{ width: '72%', alignSelf: 'flex-start' }}>
          <Notebook lines={paper} tilt={-3} />
        </Box>
        <Box sx={{ width: '92%', alignSelf: 'flex-end', mt: -2, position: 'relative' }}>{children}</Box>
      </Stack>
    </Box>
  );
}

function CashScreen() {
  const t = useT();
  const money = useMoney();
  const line = (label: string, detail: string, amount: number) =>
    <Row title={t(label)} detail={detail} end={<Typography sx={{ fontWeight: 700, color: amount > 0 ? 'success.main' : 'error.main', whiteSpace: 'nowrap', ...figures }}>{(amount > 0 ? '+' : '−') + money(Math.abs(amount))}</Typography>} />;
  return (
    <Screen title={t('landing:cash:book')}>
      {line('landing:cash:payment', 'Ahmed Trabelsi', 300000)}
      {line('landing:cash:deposit', 'VW Polo · Leila Ben Salah', 300000)}
      {line('landing:cash:expense', 'Renault Clio 5', -20000)}
      <Stack direction='row' sx={{ justifyContent: 'space-between', borderTop: '1px solid', borderColor: 'divider', pt: 1.25, mt: 0.5, mb: 1.5 }}>
        <Typography sx={{ fontWeight: 700 }}>{t('landing:cash:till')}</Typography>
        <Typography sx={{ fontWeight: 700, ...figures }}>{money(1240000)}</Typography>
      </Stack>
      <Box sx={{ mb: 1 }}><Badge label='landing:cash:owes' params={{ name: 'Sami Gharbi', amount: money(150000) }} tone='warn' /></Box>
    </Screen>
  );
}

function DisputeScreen() {
  const t = useT();
  return (
    <Screen title='Renault Clio 5' icon={<DirectionsCarOutlined fontSize='small' sx={{ color: 'text.secondary' }} />}>
      <Box sx={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 2, alignItems: 'center', py: 1 }}>
        <CarOutline earlier={[ { x: 250, y: 560 } ]} marks={[ { x: 760, y: 640 } ]} />
        <Stack sx={{ gap: 1.5 }}>
          <Row title={t('landing:dispute:pickup')} detail={<><PhotoCameraOutlined sx={{ fontSize: 14, verticalAlign: '-2px' }} /> {t('landing:dispute:photos')}</>} />
          <Row title={t('landing:dispute:return')} detail={t('landing:dispute:new')} end={<Badge label='landing:dispute:badge' tone='danger' />} />
        </Stack>
      </Box>
      <Stack direction='row' sx={{ alignItems: 'center', gap: 1.5, borderTop: '1px solid', borderColor: 'divider', pt: 1.25, pb: 1 }}>
        <Box sx={{ bgcolor: PAPER, borderRadius: 1, px: 1, border: '1px solid', borderColor: 'divider' }}>
          <svg viewBox='0 0 240 80' width='96' height='32' aria-hidden><path d='M14 58 C30 18 44 16 52 50 S74 74 88 40 S110 12 122 46 S150 70 168 36 S196 20 226 44' fill='none' stroke={PEN} strokeWidth='5' strokeLinecap='round' /></svg>
        </Box>
        <Typography variant='body2' color='text.secondary'>{t('landing:dispute:signed')}</Typography>
      </Stack>
    </Screen>
  );
}

function DatesScreen() {
  const t = useT();
  const due = (label: string, car: string, badge: string, params: object, tone: Tone) =>
    <Row title={t(label)} detail={car} end={<Badge label={badge} params={params} tone={tone} />} />;
  return (
    <Screen title={t('landing:dates:alert')} icon={<NotificationsOutlined fontSize='small' sx={{ color: 'text.secondary' }} />}>
      {due('landing:dates:inspection', 'Renault Clio 5', 'landing:dates:tomorrow', {}, 'danger')}
      {due('landing:dates:insurance', 'Hyundai Accent', 'landing:dates:in_days', { days: 7 }, 'warn')}
      {due('landing:dates:oil', 'Kia Picanto', 'landing:dates:km', { km: '1 200' }, 'warn')}
      {due('landing:dates:vignette', t('landing:dates:fleet', { count: 9 }), 'landing:dates:in_days', { days: 30 }, 'muted')}
    </Screen>
  );
}

function Day() {
  const t = useT();
  const hours = [ '08:00', '10:30', '13:00', '17:10', '19:30' ];
  return (
    <Box sx={{ ...wrap, ...section, maxWidth: 820 }}>
      <Typography variant='h2' sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' }, fontWeight: 700, lineHeight: 1.15, mb: 5, textWrap: 'balance' }}>{t('landing:day:title')}</Typography>
      <Box component='ol' sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {hours.map((hour, index) =>
          <Box component='li' key={hour} sx={{ display: 'grid', gridTemplateColumns: '72px 20px 1fr', columnGap: 2 }}>
            <Typography sx={{ fontWeight: 700, color: 'primary.main', pt: 0.25, ...figures }} dir='ltr'>{hour}</Typography>
            <Box sx={{ display: 'grid', justifyItems: 'center', gridTemplateRows: '12px 1fr', pt: 0.75 }}>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'primary.main' }} />
              {index < hours.length - 1 && <Box sx={{ width: 2, bgcolor: 'divider' }} />}
            </Box>
            <Typography sx={{ fontSize: '1rem', pb: 4 }}>{t('landing:day:' + (index + 1))}</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

// The plans as a price list, one line each, as a counter would pin it up.
function Prices() {
  const t = useT();
  const money = useMoney();
  const limit = (key: string, count: number) => t(`landing:plan:${key}` + (count === 1 ? ':one' : count ? '' : ':any'), { count }); // 0: unlimited
  return (
    <Box sx={{ ...wrap, ...section }}>
      <Stack sx={{ gap: 2, mb: 5, maxWidth: 720 }}>
        <Typography variant='h2' sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' }, fontWeight: 700, lineHeight: 1.15, textWrap: 'balance' }}>{t('landing:prices:title')}</Typography>
        <Typography sx={{ fontSize: '1rem', color: 'text.secondary' }}>{t('landing:prices:text')}</Typography>
      </Stack>
      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2.5, bgcolor: 'background.paper', overflow: 'hidden' }}>
        {PLANS.map((plan, index) =>
          <Box key={plan.id} sx={{
            display: 'grid', gridTemplateColumns: { xs: '1fr auto', md: '180px 1fr 220px' }, gap: { xs: 0.5, md: 3 }, alignItems: 'center', px: { xs: 2, md: 3 }, py: 2.5,
            borderTop: index ? '1px solid' : 'none', borderColor: 'divider', bgcolor: plan.month ? undefined : tint('primary', 0.06),
          }}>
            <Typography sx={{ fontWeight: 700, fontSize: '1.25rem' }}>{t('landing:plan:' + plan.id)}</Typography>
            <Box sx={{ textAlign: 'end', gridColumn: { md: 3 }, gridRow: { md: 1 } }}>
              <Typography sx={{ fontWeight: 700, fontSize: '1.25rem', ...figures }}>{plan.month ? t('landing:plan:month', { price: money(plan.month) }) : t('landing:plan:forever')}</Typography>
              {plan.month > 0 && <Typography variant='body2' color='text.secondary' sx={figures}>{t('landing:plan:year', { price: money(plan.month * 10) })}</Typography>}
            </Box>
            <Typography color='text.secondary' sx={{ gridColumn: { xs: '1 / -1', md: 2 }, gridRow: { md: 1 } }}>
              {[ t('landing:plan:cars', { count: plan.cars }), limit('staff', plan.staff), limit('branches', plan.branches) ].join(' · ')}
            </Typography>
          </Box>
        )}
        <Box sx={{ borderTop: '1px solid', borderColor: 'divider', px: { xs: 2, md: 3 }, py: 2.5 }}>
          <Typography><Box component='span' sx={{ fontWeight: 700 }}>{t('landing:plan:groupe')}</Box> · {t('landing:plan:groupe:text', { price: money(GROUP.month), per_car: money(GROUP.perCar) })}</Typography>
        </Box>
      </Box>
      <Box sx={{ mt: 4 }}><StartButton /></Box>
    </Box>
  );
}

function Data() {
  const t = useT();
  return (
    <Box sx={{ ...wrap, ...section }}>
      <Stack sx={{ gap: 2, mb: 5, maxWidth: 720 }}>
        <Typography variant='h2' sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' }, fontWeight: 700, lineHeight: 1.15, textWrap: 'balance' }}>{t('landing:data:title')}</Typography>
        <Typography sx={{ fontSize: '1rem', color: 'text.secondary' }}>{t('landing:data:text')}</Typography>
      </Stack>
      <Box component='dl' sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, columnGap: 8, rowGap: 3.5, m: 0 }}>
        {[ 1, 2, 3, 4, 5 ].map(item =>
          <Box key={item} sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 2 }}>
            <Typography component='dt' sx={{ fontWeight: 700, mb: 0.5 }}>{t(`landing:data:${item}:title`)}</Typography>
            <Typography component='dd' color='text.secondary' sx={{ m: 0 }}>{t(`landing:data:${item}`)}</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

function Questions() {
  const t = useT();
  return (
    <Box sx={{ ...wrap, ...section, maxWidth: 820 }}>
      <Typography variant='h2' sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' }, fontWeight: 700, lineHeight: 1.15, mb: 4 }}>{t('landing:faq:title')}</Typography>
      {[ 1, 2, 3, 4 ].map(item =>
        <Accordion key={item} disableGutters elevation={0} sx={{ bgcolor: 'transparent', borderTop: '1px solid', borderColor: 'divider', '&::before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 0 }}>
            <Typography component='h3' sx={{ fontWeight: 600, fontSize: '1rem' }}>{t(`landing:faq:${item}:q`)}</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 0, pt: 0, pb: 2.5 }}>
            <Typography color='text.secondary'>{t(`landing:faq:${item}:a`)}</Typography>
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
}

function Header() {
  const t = useT();
  const { user } = useStore();
  return (
    <Stack direction='row' sx={{ ...wrap, alignItems: 'center', justifyContent: 'space-between', gap: 2, py: 2 }}>
      <Stack direction='row' sx={{ alignItems: 'center', gap: 1.25 }}>
        <Box sx={{ width: 36, height: 36, borderRadius: 1.5, display: 'grid', placeItems: 'center', bgcolor: 'rgb(var(--mui-palette-nav-contrastTextChannel) / 0.14)' }}>
          <DirectionsCarOutlined fontSize='small' />
        </Box>
        <Typography sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{BRAND}</Typography>
      </Stack>
      <Stack direction='row' sx={{ alignItems: 'center', gap: { xs: 1, sm: 1.5 } }}>
        <Box sx={{ width: { xs: 100, sm: 170 }, bgcolor: 'background.paper', borderRadius: 1 }}><LangSelect /></Box>
        <Button component={Link} href={user ? '/today' : '/login'} variant='outlined' sx={{ color: onNav, borderColor: 'rgb(var(--mui-palette-nav-contrastTextChannel) / 0.5)', whiteSpace: 'nowrap', px: { xs: 1.25, sm: 2 }, '&:hover': { borderColor: onNav } }}>
          {t(user ? 'landing:open_app' : 'landing:signin')}
        </Button>
      </Stack>
    </Stack>
  );
}

export default function HomePage() {
  const t = useT();
  const { user } = useStore();
  return (
    <Box sx={{ bgcolor: 'background.default', color: 'text.primary', minHeight: '100vh', '& ::selection': { bgcolor: tint('primary', 0.22) } }}>
      <Box component='header' sx={{ bgcolor: 'nav.main', color: onNav, '& ::selection': { bgcolor: 'rgb(var(--mui-palette-nav-contrastTextChannel) / 0.3)' } }}>
        <Header />
        <Hero />
      </Box>
      <Box component='main'>
        <Stack sx={{ ...wrap, ...section, gap: { xs: 10, md: 14 } }}>
          <Pillar name='cash' paper={[ t('landing:cash:paper:1'), t('landing:cash:paper:2') ]}><CashScreen /></Pillar>
          <Pillar name='dispute' paper={[ t('landing:dispute:paper:1'), t('landing:dispute:paper:2') ]} reverse><DisputeScreen /></Pillar>
          <Pillar name='dates' paper={[ t('landing:dates:paper:1'), t('landing:dates:paper:2') ]}><DatesScreen /></Pillar>
        </Stack>
        <Box sx={{ bgcolor: 'background.paper', borderBlock: '1px solid', borderColor: 'divider' }}><Day /></Box>
        <Prices />
        <Box sx={{ bgcolor: 'background.paper', borderBlock: '1px solid', borderColor: 'divider' }}><Data /></Box>
        <Questions />
        <Box sx={{ bgcolor: 'nav.main', color: onNav }}>
          <Stack sx={{ ...wrap, ...section, gap: 3, alignItems: 'flex-start' }}>
            <Typography variant='h2' sx={{ fontSize: { xs: '2rem', md: '2.75rem' }, fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em', maxWidth: '16em', textWrap: 'balance' }}>{t('landing:end:title')}</Typography>
            <StartButton onNavField />
          </Stack>
        </Box>
      </Box>
      <Stack component='footer' direction={{ xs: 'column', sm: 'row' }} sx={{ ...wrap, py: 4, gap: 2, justifyContent: 'space-between', alignItems: { sm: 'center' } }}>
        <Typography variant='body2' color='text.secondary'><Box component='span' sx={{ fontWeight: 700, color: 'text.primary' }}>{BRAND}</Box> · {t('landing:footer:made')}</Typography>
        <Stack direction='row' sx={{ gap: 3, alignItems: 'center' }}>
          <Typography component={Link} href={user ? '/today' : '/login'} variant='body2' sx={{ color: 'primary.main', fontWeight: 600, textUnderlineOffset: 3 }}>{t(user ? 'landing:open_app' : 'landing:signin')}</Typography>
          <Box sx={{ width: 170 }}><LangSelect /></Box>
        </Stack>
      </Stack>
    </Box>
  );
}
