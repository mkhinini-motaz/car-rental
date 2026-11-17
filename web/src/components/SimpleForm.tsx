import React from 'react';
import { Box, Button, Card, CardContent, Stack } from '@mui/material';
import { useT } from '../store/Store';
import { Page } from './common';

// A settings page's form: a card of fields and a save button.
export default function SimpleForm({ title, onSubmit, isSaving, children }: { title: string, onSubmit: () => void, isSaving: boolean, children: React.ReactNode }) {
  const t = useT();
  return (
    <Page title={title}>
      <Card sx={{ maxWidth: 560 }}>
        <CardContent component='form' noValidate onSubmit={(event: React.FormEvent) => { event.preventDefault(); onSubmit(); }}>
          <Stack sx={{ gap: 2.5 }}>
            {children}
            <Box><Button type='submit' variant='contained' loading={isSaving}>{t('common:save')}</Button></Box>
          </Stack>
        </CardContent>
      </Card>
    </Page>
  );
}
