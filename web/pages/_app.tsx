import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { prefixer } from 'stylis';
import rtlPlugin from 'stylis-plugin-rtl';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { useColorScheme } from '@mui/material/styles';
import Agency, { THEME_MODE_DARK, THEME_MODE_DEVICE, THEME_MODE_LIGHT } from '../src/classes/Agency';
import Store, { useLang, useStore } from '../src/store/Store';
import { FeedbackProvider } from '../src/components/Feedback';
import { Loading } from '../src/components/common';
import Layout from '../src/layout/Layout';
import { DEFAULT_THEME, isThemeId, makeTheme } from '../src/theme';
import { show as showAgency } from '../src/api/agency';

// Arabic flips MUI's margins and paddings too, not just the text.
const caches = {
  ltr: createCache({ key: 'mui', prepend: true }),
  rtl: createCache({ key: 'muirtl', prepend: true, stylisPlugins: [ prefixer, rtlPlugin ] }),
};

const queryClient = new QueryClient({
  defaultOptions: {
    // Retry only when the API couldn't be reached; a 403 or 404 won't change.
    queries: { retry: (count, error: any) => count < 2 && ! error?.response },
  },
});

// Staff land here after signing in; `/` is the public home page.
const TODAY = '/today';

// Only a path of this app: never send someone to another site after login.
const safeNext = (next: unknown) => typeof next === 'string' && next.startsWith('/') && ! next.startsWith('//') ? next : TODAY;

// Pages anyone opens without signing in, outside the staff layout: the home page, and the
// client's check-in reached by a signed link.
const HOME = '/';
const HOME_DESCRIPTION = "Le carnet de l'agence de location sur le téléphone : réservations, départs et retours avec photos, caisse et échéances des papiers. Gratuit jusqu'à 4 voitures.";
const PUBLIC_PAGES = [ HOME, '/checkin' ];

// Pages for someone signed out; a signed-in user goes on to `next` or Today.
const GUEST_PAGES = [ '/login', '/signup' ];

// Everything but the guest pages needs a signed-in user; the layout comes with it.
function Shell({ Component, pageProps }: AppProps) {
  const router = useRouter();
  if (PUBLIC_PAGES.includes(router.pathname)) {
    return <Component {...pageProps} />;
  }
  return <StaffShell Component={Component} pageProps={pageProps} />;
}

function StaffShell({ Component, pageProps }: Pick<AppProps, 'Component'|'pageProps'>) {
  const router = useRouter();
  const { user, isRestoringSession } = useStore();
  const isLogin = GUEST_PAGES.includes(router.pathname);
  const mustRedirect = ! isRestoringSession && (isLogin ? !! user : ! user);

  useEffect(() => {
    if (! mustRedirect) {
      return;
    }
    if (isLogin) {
      router.replace(safeNext(router.query.next));
    } else {
      router.replace(router.asPath === TODAY ? '/login' : '/login?next=' + encodeURIComponent(router.asPath));
    }
  }, [mustRedirect, isLogin, router]);

  if (isRestoringSession || mustRedirect) {
    return <Loading />;
  }
  return isLogin ? <Component {...pageProps} /> : <Layout><Component {...pageProps} /></Layout>;
}

// Light, dark or as the device is set: the owner's choice for the whole agency.
const MODES = { [THEME_MODE_DEVICE]: 'system', [THEME_MODE_LIGHT]: 'light', [THEME_MODE_DARK]: 'dark' } as const;

function AgencyMode({ themeMode }: { themeMode?: Agency['theme_mode'] }) {
  const { setMode } = useColorScheme();
  useEffect(() => {
    if (themeMode) {
      setMode(MODES[themeMode]);
    }
  }, [themeMode, setMode]);
  return null;
}

// The agency's palette once signed in (the default before). The home page is the platform's, not
// an agency's: it keeps the default palette and follows the device's light or dark.
function Themed(props: AppProps) {
  const { isRtl } = useLang();
  const { user } = useStore();
  const isHome = props.router.pathname === HOME;
  const { data: agency } = useQuery({ queryKey: ['agency.show'], queryFn: showAgency, enabled: !! user });
  const themeId = ! isHome && isThemeId(agency?.theme) ? agency.theme : DEFAULT_THEME;
  const theme = useMemo(() => makeTheme(isRtl ? 'rtl' : 'ltr', themeId), [isRtl, themeId]);
  return (
    <CacheProvider value={isRtl ? caches.rtl : caches.ltr}>
      <ThemeProvider theme={theme} defaultMode='system'>
        <CssBaseline enableColorScheme />
        <AgencyMode themeMode={isHome ? THEME_MODE_DEVICE : agency?.theme_mode} />
        <FeedbackProvider>
          <Shell {...props} />
        </FeedbackProvider>
      </ThemeProvider>
    </CacheProvider>
  );
}

// Client-rendered only: the session lives in localStorage and every page needs it. Waiting for
// `router.isReady` also gives dynamic pages their `[id]` on the first render.
export default function App(props: AppProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      <Head>
        <title>Car rental</title>
        <meta name='viewport' content='initial-scale=1, width=device-width' />
        {/* In the served HTML (the pages render in the browser): what search engines and link previews read. */}
        {props.router.pathname === HOME ? <meta name='description' content={HOME_DESCRIPTION} /> : <meta name='robots' content='noindex, nofollow' />}
      </Head>
      {mounted && props.router.isReady &&
        <QueryClientProvider client={queryClient}>
          <Store>
            <Themed {...props} />
          </Store>
        </QueryClientProvider>
      }
    </>
  );
}
