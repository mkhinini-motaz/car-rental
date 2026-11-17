import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, IconButton, Stack, Typography } from '@mui/material';
import AddAPhoto from '@mui/icons-material/AddAPhotoOutlined';
import DeleteOutline from '@mui/icons-material/DeleteOutlined';
import { destroy, store } from '../api/document';
import DocumentPhoto from '../classes/Document';
import { COLORS, Tone } from '../constants';
import { useT } from '../store/Store';
import { resizePhoto } from '../support/photo';
import { useFeedback } from './Feedback';
import { Section } from './common';

interface DocumentsProps {
  owner: 'car'|'client',
  ownerId: number,
  documents: DocumentPhoto[],
  types: number[],
  dates?: Record<number, { date: string, tone?: Tone }>, // the paper's expiry, shown beside it
  hint?: string,
}

// Photos of a car's or a client's papers, one row per kind: add one, click to see it large and
// delete it.
export function Documents({ owner, ownerId, documents, types, dates = {}, hint }: DocumentsProps) {
  const t = useT();
  const queryClient = useQueryClient();
  const { confirm, requestError } = useFeedback();
  const [open, setOpen] = useState<DocumentPhoto|null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: [owner + '.show'] });
  const add = useMutation({
    mutationFn: ({ type, photo }: { type: number, photo: File }) => store(owner, ownerId, type, photo),
    onSuccess: refresh,
    onError: requestError,
  });
  const remove = useMutation({
    mutationFn: (id: number) => destroy(id),
    onSuccess: () => {
      setOpen(null);
      refresh();
    },
    onError: requestError,
  });

  return (
    <Section title='document:title'>
      {hint && <Typography variant='body2' color='text.secondary'>{t(hint)}</Typography>}
      {types.map(type => {
        const date = dates[type];
        return (
          <Stack key={type} direction='row' sx={{ alignItems: 'center', gap: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Typography>{t('document:type:' + type)}</Typography>
              {date && <Typography variant='body2' sx={{ fontWeight: 600, color: date.tone ? COLORS[date.tone] : 'text.secondary' }}>{t('document:until', { date: date.date })}</Typography>}
            </Box>
            {documents.filter(document => document.type === type).map(document =>
              <Box key={document.id} component='button' onClick={() => setOpen(document)} sx={{ p: 0, border: 0, cursor: 'pointer', bgcolor: 'transparent' }}>
                <img src={document.url} alt={t('document:type:' + type)} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, display: 'block' }} />
              </Box>
            )}
            {add.isPending && add.variables?.type === type ? <CircularProgress size={24} sx={{ m: 1 }} /> :
              <IconButton color='primary' component='label' aria-label={t('document:type:' + type)}>
                <AddAPhoto />
                <input type='file' accept='image/*' hidden onChange={async event => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) {
                    add.mutate({ type, photo: await resizePhoto(file) });
                  }
                }} />
              </IconButton>}
          </Stack>
        );
      })}

      <Dialog open={!! open} onClose={() => setOpen(null)} maxWidth='lg'>
        <DialogContent sx={{ p: 1 }}>
          {open && <img src={open.url} alt={t('document:type:' + open.type)} style={{ maxWidth: '100%', maxHeight: '80vh', display: 'block' }} />}
        </DialogContent>
        <DialogActions>
          <Button color='error' startIcon={<DeleteOutline />} loading={remove.isPending} onClick={async () => open && await confirm('document:delete:confirm') && remove.mutate(open.id)}>{t('document:delete')}</Button>
          <Button onClick={() => setOpen(null)}>{t('common:close')}</Button>
        </DialogActions>
      </Dialog>
    </Section>
  );
}
