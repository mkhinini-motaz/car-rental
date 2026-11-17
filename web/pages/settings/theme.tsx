import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Typography } from '@mui/material';
import { useColorScheme } from '@mui/material/styles';
import CheckCircle from '@mui/icons-material/CheckCircle';
import { update, useAgency } from '../../src/api/agency';
import Agency, { THEME_MODES } from '../../src/classes/Agency';
import { useT } from '../../src/store/Store';
import { DEFAULT_THEME, isThemeId, PALETTES, THEME_FAMILIES, ThemeId } from '../../src/theme';
import { useFeedback } from '../../src/components/Feedback';
import { bareButton, Choice, Loading, Page, Section } from '../../src/components/common';

const MODE_LABELS = { 1: 'theme:system', 2: 'theme:light', 3: 'theme:dark' } as const;

// A small picture of the palette: the sidebar, a title, statuses and a button, in the scheme shown now.
function Preview({ id, scheme }: { id: ThemeId, scheme: 'light'|'dark' }) {
  const colors = PALETTES[id][scheme];
  const line = (width: string, background: string, opacity = 1) => <div style={{ height: 5, width, background, opacity, borderRadius: 3 }} />;
  return (
    <div dir='ltr' style={{ display: 'flex', height: 72, background: colors.canvas }}>
      <div style={{ width: '30%', background: colors.nav, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {line('80%', colors.onNav, 0.9)}
        {line('60%', colors.onNav, 0.5)}
        {line('70%', colors.onNav, 0.5)}
      </div>
      <div style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {line('60%', colors.ink)}
        <div style={{ display: 'flex', gap: 4 }}>
          {[ colors.ink, colors.info, colors.danger, colors.ok ].map((background, index) => <div key={index} style={{ height: 8, width: 16, background, borderRadius: 3 }} />)}
        </div>
        <div style={{ height: 14, width: 48, background: colors.primary, borderRadius: 7 }} />
      </div>
    </div>
  );
}

// The agency's look, for every staff member on the web and the phone: light or dark, and a palette.
// A choice applies at once.
export default function ThemePage() {
  const t = useT();
  const queryClient = useQueryClient();
  const { notify, requestError } = useFeedback();
  const { colorScheme } = useColorScheme();
  const { data } = useAgency();
  const save = useMutation({
    mutationFn: (change: Pick<Agency, 'theme'> | Pick<Agency, 'theme_mode'>) => update(change),
    onMutate: change => {
      const before = queryClient.getQueryData<Agency>(['agency.show']);
      queryClient.setQueryData<Agency>(['agency.show'], current => current && { ...current, ...change });
      return before;
    },
    onSuccess: agency => {
      queryClient.setQueryData(['agency.show'], agency);
      notify('settings:saved', 'success');
    },
    onError: (error, _change, before) => {
      queryClient.setQueryData(['agency.show'], before);
      requestError(error);
    },
  });
  if (! data) {
    return <Loading />;
  }
  const current = isThemeId(data.theme) ? data.theme : DEFAULT_THEME;
  const scheme = colorScheme ?? 'light';

  return (
    <Page title='theme:label'>
      <Box sx={{ maxWidth: 900 }}>
        <Typography color='text.secondary' sx={{ mb: 2 }}>{t('theme:hint')}</Typography>
        <Section title='theme:mode'>
          <Choice value={data.theme_mode} onChange={theme_mode => save.mutate({ theme_mode })} options={THEME_MODES.map(value => ({ label: MODE_LABELS[value], value }))} />
        </Section>
        <Section title='theme:palette'>
          {(Object.keys(THEME_FAMILIES) as (keyof typeof THEME_FAMILIES)[]).map(family =>
            <Box key={family} sx={{ mb: 1 }}>
              <Typography variant='subtitle2' color='text.secondary' sx={{ mb: 1 }}>{t('theme:family:' + family)}</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 1.5 }}>
                {THEME_FAMILIES[family].map(id => {
                  const isCurrent = id === current;
                  return (
                    <Box
                      key={id}
                      component='button'
                      type='button'
                      aria-pressed={isCurrent}
                      onClick={() => ! isCurrent && save.mutate({ theme: id })}
                      sx={{ ...bareButton, borderRadius: 2, overflow: 'hidden', border: '2px solid', borderColor: isCurrent ? 'primary.main' : 'divider', bgcolor: 'background.paper' }}
                    >
                      <Preview id={id} scheme={scheme} />
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, px: 1.25, py: 0.75 }}>
                        <Typography sx={{ fontWeight: 600 }}>{t('theme:palette:' + id)}</Typography>
                        {isCurrent && <CheckCircle color='primary' fontSize='small' />}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}
        </Section>
      </Box>
    </Page>
  );
}
