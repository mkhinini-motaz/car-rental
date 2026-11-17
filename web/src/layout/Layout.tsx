import React, { ReactNode, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AppBar, Avatar, Box, Divider, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText, MenuItem, Select, Stack, Toolbar, Typography,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import HomeOutlined from '@mui/icons-material/HomeOutlined';
import TodayOutlined from '@mui/icons-material/TodayOutlined';
import AccountBalanceWalletOutlined from '@mui/icons-material/AccountBalanceWalletOutlined';
import EventRepeatOutlined from '@mui/icons-material/EventRepeatOutlined';
import NoCrashOutlined from '@mui/icons-material/NoCrashOutlined';
import DirectionsCarOutlined from '@mui/icons-material/DirectionsCarOutlined';
import PeopleOutlined from '@mui/icons-material/PeopleOutlined';
import ViewTimelineOutlined from '@mui/icons-material/ViewTimelineOutlined';
import EditCalendarOutlined from '@mui/icons-material/EditCalendarOutlined';
import CarRentalOutlined from '@mui/icons-material/CarRentalOutlined';
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined';
import PointOfSaleOutlined from '@mui/icons-material/PointOfSaleOutlined';
import InsightsOutlined from '@mui/icons-material/InsightsOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import Logout from '@mui/icons-material/Logout';
import { show as agency } from '../api/agency';
import { logout } from '../api/auth';
import { availableLangs } from '../i18n';
import { clearUserToken } from '../support/auth';
import { useIsOwner, useLang, useStore, useT } from '../store/Store';
import { useFeedback } from '../components/Feedback';
import Translatable from '../classes/Translatable';

const WIDTH = 248;

// The phone app's tabs, then its "More" groups; owner-only entries hidden from managers.
const GROUPS: { title?: string, entries: { href: string, label: string, Icon: typeof HomeOutlined, ownerOnly?: boolean }[] }[] = [
  { entries: [
    { href: '/today', label: 'common:today', Icon: TodayOutlined },
    { href: '/planning', label: 'common:planning', Icon: ViewTimelineOutlined },
    { href: '/cars', label: 'common:cars', Icon: DirectionsCarOutlined },
    { href: '/clients', label: 'common:clients', Icon: PeopleOutlined },
  ] },
  { title: 'more:daily', entries: [
    { href: '/reservation', label: 'common:reservation:create', Icon: EditCalendarOutlined },
    { href: '/rented', label: 'common:rented_cars', Icon: CarRentalOutlined },
    { href: '/fines', label: 'common:fines', Icon: ReceiptLongOutlined },
  ] },
  { title: 'more:money', entries: [
    { href: '/cashbook', label: 'common:cash_book', Icon: PointOfSaleOutlined, ownerOnly: true },
    { href: '/reports', label: 'common:reports', Icon: InsightsOutlined, ownerOnly: true },
    { href: '/payroll', label: 'payroll:label', Icon: AccountBalanceWalletOutlined, ownerOnly: true },
    { href: '/bills', label: 'bill:label', Icon: EventRepeatOutlined, ownerOnly: true },
    { href: '/cars/sold', label: 'car:sold:label', Icon: NoCrashOutlined, ownerOnly: true },
  ] },
  { entries: [
    { href: '/settings', label: 'common:settings', Icon: SettingsOutlined },
  ] },
];

function LangSelect() {
  const { selectedLang, setLang } = useLang();
  const t = useT();
  return (
    <Select size='small' fullWidth inputProps={{ 'aria-label': t('common:language') }} value={selectedLang} onChange={event => setLang(event.target.value as keyof Translatable)}>
      {Object.keys(availableLangs).map(lang => <MenuItem key={lang} value={lang}>{t('lang:' + lang)}</MenuItem>)}
    </Select>
  );
}

function Nav({ onNavigate }: { onNavigate: () => void }) {
  const t = useT();
  const router = useRouter();
  const isOwner = useIsOwner();
  const { user, setUser } = useStore();
  const queryClient = useQueryClient();
  const { confirm } = useFeedback();
  const { data } = useQuery({ queryKey: ['agency.show'], queryFn: agency });
  // The longest matching entry wins (/cars/sold over /cars).
  const hrefs = GROUPS.flatMap(group => group.entries.map(entry => entry.href));
  const active = hrefs.filter(href => router.pathname.startsWith(href)).sort((a, b) => b.length - a.length)[0];
  const isActive = (href: string) => href === active;

  const onLogout = async () => {
    if (! await confirm('common:logout:confirm')) {
      return;
    }
    // Revoke the token on the API; log out locally even if that fails (offline).
    await logout().catch(() => {});
    clearUserToken();
    queryClient.clear();
    setUser(null);
  };

  return (
    <Stack sx={{ height: '100%' }}>
      <Stack direction='row' sx={{ alignItems: 'center', gap: 1.5, p: 2 }}>
        <Avatar src={data?.logo_url ?? undefined} variant='rounded' sx={{ bgcolor: 'rgb(var(--mui-palette-nav-contrastTextChannel) / 0.14)', color: 'nav.contrastText' }}>
          <DirectionsCarOutlined />
        </Avatar>
        <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }}>{data?.name ?? ''}</Typography>
      </Stack>
      <Divider sx={{ borderColor: 'rgb(var(--mui-palette-nav-contrastTextChannel) / 0.14)' }} />
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1 }}>
        {GROUPS.map((group, index) => {
          const entries = group.entries.filter(entry => ! entry.ownerOnly || isOwner);
          return entries.length > 0 && <List key={index} dense subheader={group.title && <Typography variant='overline' sx={{ px: 2, opacity: 0.6, display: 'block' }}>{t(group.title)}</Typography>}>
            {entries.map(({ href, label, Icon }) =>
              <ListItemButton
                key={href}
                component={Link}
                href={href}
                onClick={onNavigate}
                selected={isActive(href)}
                sx={{ borderRadius: 2, mb: 0.25, color: 'inherit', '&.Mui-selected': { bgcolor: 'rgb(var(--mui-palette-nav-contrastTextChannel) / 0.14)' }, '&.Mui-selected:hover': { bgcolor: 'rgb(var(--mui-palette-nav-contrastTextChannel) / 0.2)' } }}
              >
                <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}><Icon /></ListItemIcon>
                <ListItemText primary={t(label)} />
              </ListItemButton>
            )}
          </List>;
        })}
      </Box>
      <Stack sx={{ p: 2, gap: 1.5 }}>
        <Box sx={{ bgcolor: 'background.paper', borderRadius: 1 }}><LangSelect /></Box>
        <Stack direction='row' sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant='body2' sx={{ fontWeight: 600 }}>{user?.first_name} {user?.last_name}</Typography>
            <Typography variant='caption' sx={{ opacity: 0.7 }}>{user && t('staff:role:' + user.role)}</Typography>
          </Box>
          <IconButton color='inherit' onClick={onLogout} title={t('common:logout')}><Logout /></IconButton>
        </Stack>
      </Stack>
    </Stack>
  );
}

// Sidebar on a desktop, a menu button on a phone.
export default function Layout({ children }: { children: ReactNode }) {
  const t = useT();
  const [isOpen, setIsOpen] = useState(false);
  const paper = { width: WIDTH, bgcolor: 'nav.main', color: 'nav.contrastText', border: 'none', borderInlineEnd: '1px solid', borderColor: 'divider' }; // the edge shows on a white sidebar

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position='fixed' sx={{ display: { md: 'none' }, bgcolor: 'nav.main', color: 'nav.contrastText' }}>
        <Toolbar>
          <IconButton color='inherit' edge='start' aria-label={t('common:menu')} onClick={() => setIsOpen(true)}><MenuIcon /></IconButton>
        </Toolbar>
      </AppBar>
      <Drawer variant='temporary' open={isOpen} onClose={() => setIsOpen(false)} sx={{ display: { md: 'none' } }} slotProps={{ paper: { sx: paper } }}>
        <Nav onNavigate={() => setIsOpen(false)} />
      </Drawer>
      <Drawer variant='permanent' sx={{ display: { xs: 'none', md: 'block' }, width: WIDTH, flexShrink: 0 }} slotProps={{ paper: { sx: paper } }}>
        <Nav onNavigate={() => {}} />
      </Drawer>
      <Box component='main' sx={{ flex: 1, minWidth: 0, pt: { xs: 7, md: 0 } }}>{children}</Box>
    </Box>
  );
}

export { LangSelect };
