import React from 'react';
import Link from 'next/link';
import { Box, Card, List, ListItemButton, ListItemIcon, ListItemText, ListSubheader, Typography } from '@mui/material';
import ManageAccounts from '@mui/icons-material/ManageAccountsOutlined';
import Lock from '@mui/icons-material/LockOutlined';
import Storefront from '@mui/icons-material/StorefrontOutlined';
import Sell from '@mui/icons-material/SellOutlined';
import Store from '@mui/icons-material/StoreOutlined';
import EventRepeat from '@mui/icons-material/EventRepeatOutlined';
import Badge from '@mui/icons-material/BadgeOutlined';
import Wallet from '@mui/icons-material/AccountBalanceWalletOutlined';
import Notifications from '@mui/icons-material/NotificationsOutlined';
import Palette from '@mui/icons-material/PaletteOutlined';
import UploadFile from '@mui/icons-material/UploadFileOutlined';
import { useIsOwner, useT, useUser } from '../../src/store/Store';
import { formatLocalPhoneNumber } from '../../src/support/utils';
import { LangSelect } from '../../src/layout/Layout';
import { Page, Section } from '../../src/components/common';

type Row = [ string, string, typeof Lock, string? ];

// Grouped like the phone app: your account, then the agency's (owner only), then the app.
export default function SettingsPage() {
  const t = useT();
  const isOwner = useIsOwner();
  const user = useUser();
  const group = (title: string, rows: Row[]) =>
    <Card sx={{ mb: 2 }}>
      <List subheader={<ListSubheader sx={{ bgcolor: 'transparent' }}>{t(title)}</ListSubheader>}>
        {rows.map(([ href, label, Icon, subtitle ]) =>
          <ListItemButton key={href} component={Link} href={href}>
            <ListItemIcon><Icon color='primary' /></ListItemIcon>
            <ListItemText primary={<Typography sx={{ fontWeight: 600 }}>{t(label)}</Typography>} secondary={subtitle} />
          </ListItemButton>
        )}
      </List>
    </Card>;

  return (
    <Page title='common:settings'>
      <Box sx={{ maxWidth: 560 }}>
        {group('settings:account', [
          [ '/settings/profile', 'settings:profile', ManageAccounts, user ? user.first_name + ' ' + user.last_name + ' · ' + formatLocalPhoneNumber(user.phone) : undefined ],
          [ '/settings/password', 'settings:password', Lock ],
        ])}
        {isOwner && group('settings:agency', [
          [ '/settings/agency', 'agency:edit', Storefront ],
          [ '/settings/theme', 'theme:label', Palette ],
          [ '/settings/pricing', 'pricing:label', Sell ],
          [ '/settings/branches', 'branch:label', Store ],
          [ '/bills', 'bill:label', EventRepeat ],
          [ '/settings/import', 'import:title', UploadFile ],
        ])}
        {isOwner && group('settings:team', [
          [ '/settings/staff', 'staff:label', Badge ],
          [ '/payroll', 'payroll:label', Wallet ],
        ])}
        <Section title='settings:language'><LangSelect /></Section>
        {isOwner && group('settings:app', [ [ '/settings/reminders', 'settings:reminders', Notifications ] ])}
      </Box>
    </Page>
  );
}
