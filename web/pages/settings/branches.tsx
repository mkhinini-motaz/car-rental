import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItemButton, ListItemText, Stack, TextField, Typography } from '@mui/material';
import Add from '@mui/icons-material/Add';
import { branches, destroyBranch, saveBranch } from '../../src/api/money';
import Branch from '../../src/classes/Branch';
import { useT } from '../../src/store/Store';
import { millimesFromInput, priceInputFromMillimes } from '../../src/support/money';
import { useFeedback } from '../../src/components/Feedback';
import { Empty, Loading, Page, useMoney } from '../../src/components/common';

// Adds a branch, or edits or removes `branch`.
function BranchDialog({ branch, onClose }: { branch: Branch|null, onClose: () => void }) {
  const t = useT();
  const queryClient = useQueryClient();
  const { notify, confirm, requestError } = useFeedback();
  const [name, setName] = useState(branch?.name ?? '');
  const [address, setAddress] = useState(branch?.address ?? '');
  const [rent, setRent] = useState(branch?.monthly_rent ? priceInputFromMillimes(branch.monthly_rent) : '');
  const onSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['branch.index'] });
    onClose();
  };
  const save = useMutation({ mutationFn: () => saveBranch({ name: name.trim(), address: address.trim() || null, monthly_rent: millimesFromInput(rent) ?? 0 }, branch?.id), onSuccess, onError: requestError });
  const remove = useMutation({ mutationFn: () => destroyBranch(branch!.id), onSuccess, onError: requestError });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth='sm'>
      <DialogTitle>{t('branch:label')}</DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 2.5, pt: 1 }}>
          <TextField label={t('branch:name')} value={name} onChange={event => setName(event.target.value)} required />
          <TextField label={t('form:address:label')} value={address} onChange={event => setAddress(event.target.value)} />
          <TextField label={t('branch:rent')} value={rent} onChange={event => setRent(event.target.value)} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
        </Stack>
      </DialogContent>
      <DialogActions>
        {branch && <Button color='error' loading={remove.isPending} onClick={async () => await confirm('branch:delete:confirm') && remove.mutate()} sx={{ mr: 'auto' }}>{t('branch:delete')}</Button>}
        <Button onClick={onClose}>{t('common:cancel')}</Button>
        <Button variant='contained' loading={save.isPending} onClick={() => name.trim() ? save.mutate() : notify('branch:invalid', 'error')}>{t('common:save')}</Button>
      </DialogActions>
    </Dialog>
  );
}

// The agency's premises and their rent (owner); agency expenses and cars can be tagged with one.
export default function BranchesPage() {
  const t = useT();
  const money = useMoney();
  const [editing, setEditing] = useState<Branch|null|undefined>(undefined); // null: a new one
  const { isLoading, data } = useQuery({ queryKey: ['branch.index'], queryFn: branches });

  return (
    <Page title='branch:label' actions={<Button variant='contained' startIcon={<Add />} onClick={() => setEditing(null)}>{t('branch:add')}</Button>}>
      <Typography color='text.secondary' sx={{ mb: 2 }}>{t('branch:hint')}</Typography>
      {isLoading ? <Loading /> : ! data?.length ? <Empty text='branch:none' /> :
        <Card>
          <List disablePadding>
            {data.map(branch =>
              <ListItemButton key={branch.id} divider onClick={() => setEditing(branch)}>
                <ListItemText primary={branch.name} secondary={branch.address} />
                {!! branch.monthly_rent && <Typography sx={{ fontWeight: 700 }}>{money(branch.monthly_rent)}</Typography>}
              </ListItemButton>
            )}
          </List>
        </Card>
      }
      {editing !== undefined && <BranchDialog branch={editing} onClose={() => setEditing(undefined)} />}
    </Page>
  );
}
