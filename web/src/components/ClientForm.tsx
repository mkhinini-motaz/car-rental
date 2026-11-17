import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Button, Card, CardContent, Stack } from '@mui/material';
import { show, store, update } from '../api/clients';
import { useT } from '../store/Store';
import { useFeedback } from './Feedback';
import { Loading, Page } from './common';
import { ClientFields, clientFormErrors, ClientFormValue, clientServerErrors, clientToForm, emptyClientForm, formToClientInput } from './client';

// Creates a client, or edits one when `clientId` is given.
export default function ClientForm({ clientId }: { clientId?: number }) {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { requestError } = useFeedback();
  const [value, setValue] = useState<ClientFormValue>(emptyClientForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { isLoading, data } = useQuery({ queryKey: ['client.show', { id: clientId }], queryFn: show, enabled: !! clientId });
  useEffect(() => {
    if (data) {
      setValue(clientToForm(data));
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => clientId ? update(clientId, formToClientInput(value)) : store(formToClientInput(value)),
    onSuccess: (client) => {
      // Pickup checks the client's details; lists and the dashboard show the name.
      for (const key of [ 'client.index', 'client.show', 'contract.index', 'contract.show', 'dashboard' ]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      if (typeof router.query.back === 'string' && router.query.back.startsWith('/') && ! router.query.back.startsWith('//')) {
        router.replace(router.query.back); // came from a handover to complete the client
      } else {
        router.replace('/clients/' + client.id);
      }
    },
    onError: (error) => {
      const fieldErrors = clientServerErrors(error);
      setErrors(fieldErrors);
      if (! Object.keys(fieldErrors).length) {
        requestError(error);
      }
    },
  });

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const fieldErrors = clientFormErrors(value);
    setErrors(fieldErrors);
    if (! Object.keys(fieldErrors).length) {
      save.mutate();
    }
  };

  if (clientId && isLoading) {
    return <Loading />;
  }

  return (
    <Page title={clientId ? 'client:edit' : 'client:new'}>
      <Card sx={{ maxWidth: 720 }}>
        <CardContent component='form' onSubmit={onSubmit} noValidate>
          <Stack sx={{ gap: 3 }}>
            <ClientFields value={value} onChange={setValue} errors={errors} />
            <Box><Button type='submit' variant='contained' size='large' loading={save.isPending}>{t('common:save')}</Button></Box>
          </Stack>
        </CardContent>
      </Card>
    </Page>
  );
}
