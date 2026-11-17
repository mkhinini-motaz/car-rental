import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, Collapse, Stack, Typography } from '@mui/material';
import Download from '@mui/icons-material/Download';
import UploadFile from '@mui/icons-material/UploadFile';
import FactCheck from '@mui/icons-material/FactCheck';
import DoneAll from '@mui/icons-material/DoneAll';
import Refresh from '@mui/icons-material/Refresh';
import TableChart from '@mui/icons-material/TableChart';
import {
  checkFiles, checkRows, emptyReview, guide as fetchGuide, IMPORT_KINDS, importableCount, ImportKind, ImportReport, pendingGuesses, rowsToSend,
} from '../../src/api/import';
import { invalidateContractQueries } from '../../src/api/contract';
import { MONEY_QUERIES } from '../../src/api/money';
import { useT } from '../../src/store/Store';
import { validationErrors } from '../../src/support/alert';
import { useFeedback } from '../../src/components/Feedback';
import { ColumnTable, ImportReview } from '../../src/components/import';
import { Empty, Loading, Page, Section } from '../../src/components/common';

type Counts = { new: number, updated: number, unchanged: number, rejected: number };

// The owner brings the agency's cars, clients and rentals in from spreadsheets, as on the phone: a guide
// and a template per file, then a check that fixes what it can and asks about its guesses, then the import.
export default function ImportPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const { notify, requestError } = useFeedback();
  const { isLoading, data: guide } = useQuery({ queryKey: ['import.guide'], queryFn: fetchGuide });
  const [files, setFiles] = useState<Partial<Record<ImportKind, File>>>({});
  const [open, setOpen] = useState<ImportKind[]>([]); // kinds whose columns are listed
  const [report, setReport] = useState<ImportReport|null>(null);
  const [review, setReview] = useState(emptyReview);
  const [isDirty, setIsDirty] = useState(false); // cells changed since the last check
  const [done, setDone] = useState<Counts|null>(null);

  // What the API said about the file itself (an .xlsx, no rows), by file.
  const onFileError = (error: unknown) => {
    const errors = validationErrors(error);
    const messages = IMPORT_KINDS.filter(kind => errors['files.' + kind]).map(kind => t('import:kind:' + kind) + ' : ' + t(errors['files.' + kind][0]));
    messages.length ? notify(messages.join(' · '), 'error') : requestError(error);
  };
  const reviewed = (next: ImportReport) => {
    // A check of rows sent back doesn't read headers again: keep what the files said.
    setReport(current => Object.fromEntries(Object.entries(next).map(([ kind, dataset ]) => [ kind, { ...dataset, header: dataset.header ?? current?.[kind as ImportKind]?.header } ])));
    setReview(current => ({ ...emptyReview, confirmed: current.confirmed.filter(key => key.includes(':header:')) })); // header guesses stay as confirmed
    setIsDirty(false);
  };
  const check = useMutation({
    mutationFn: () => checkFiles(files),
    onSuccess: (next) => {
      setReport(next);
      setReview(emptyReview);
      setIsDirty(false);
      setDone(null);
    },
    onError: onFileError,
  });
  const recheck = useMutation({ mutationFn: () => checkRows(rowsToSend(report!, review)), onSuccess: reviewed, onError: requestError });
  const save = useMutation({
    mutationFn: () => checkRows(rowsToSend(report!, review), true),
    onSuccess: (result) => {
      invalidateContractQueries(queryClient);
      [ ...MONEY_QUERIES, 'client.index' ].forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
      const counts: Counts = { new: 0, updated: 0, unchanged: 0, rejected: 0 };
      Object.values(result).forEach(dataset => (Object.keys(counts) as (keyof Counts)[]).forEach(key => counts[key] += dataset.counts[key]));
      setDone(counts);
      setFiles({});
      // What was saved is done; what wasn't stays to fix and import again.
      reviewed(Object.fromEntries(Object.entries(result).filter(([ , dataset ]) => dataset.counts.rejected).map(([ kind, dataset ]) => [ kind, {
        ...dataset, rows: dataset.rows.filter(row => row.result === 'rejected'), header: undefined,
        counts: { new: 0, updated: 0, unchanged: 0, rejected: dataset.counts.rejected },
      } ])));
    },
    onError: requestError,
  });

  if (isLoading) {
    return <Loading />;
  }
  if (! guide) {
    return <Page title='import:title'><Empty /></Page>;
  }
  const pending = report ? pendingGuesses(report, review) : [];
  const count = report ? importableCount(report, review) : 0;

  return (
    <Page title='import:title'>
      <Box sx={{ maxWidth: 960 }}>
        <Section title='import:how'>
          <Typography>{t('import:intro')}</Typography>
          <Box component='ol' sx={{ m: 0, pl: 3, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {[ 1, 2, 3, 4 ].map(step => <li key={step}><Typography>{t('import:step:' + step)}</Typography></li>)}
          </Box>
          <Typography variant='body2' color='text.secondary'>{t('import:order')}</Typography>
          <Typography variant='body2' color='text.secondary'>{t('import:again')}</Typography>
        </Section>

        {IMPORT_KINDS.map(kind =>
          <Section key={kind} title={'import:kind:' + kind}>
            <Typography color='text.secondary'>{t('import:kind:' + kind + ':hint')}</Typography>
            <Stack direction='row' sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button variant='outlined' startIcon={<Download />} href={guide[kind].template_url} download={kind + '.csv'}>{t('import:template')}</Button>
              <Button startIcon={<TableChart />} onClick={() => setOpen(current => current.includes(kind) ? current.filter(item => item !== kind) : [ ...current, kind ])} aria-expanded={open.includes(kind)}>
                {t('import:columns')}
              </Button>
            </Stack>
            <Collapse in={open.includes(kind)}><ColumnTable kind={kind} guide={guide} /></Collapse>
            <Stack direction='row' sx={{ gap: 1.5, alignItems: 'center', borderTop: 1, borderColor: 'divider', pt: 1.5 }}>
              <Button variant='contained' component='label' startIcon={<UploadFile />}>
                {t('import:file:choose')}
                <input
                  hidden
                  type='file'
                  accept='.csv,text/csv,text/plain,.txt'
                  aria-label={t('import:file:choose') + ' · ' + t('import:kind:' + kind)}
                  onChange={event => {
                    const file = event.target.files?.[0];
                    if (file) {
                      setFiles(current => ({ ...current, [kind]: file }));
                    }
                    event.target.value = ''; // the same file again after fixing it
                  }}
                />
              </Button>
              <Typography sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{files[kind]?.name ?? t('import:file:none')}</Typography>
            </Stack>
          </Section>
        )}
        <Box sx={{ mb: 2 }}>
          <Button variant='contained' size='large' startIcon={<FactCheck />} loading={check.isPending} disabled={! Object.keys(files).length} onClick={() => check.mutate()}>{t('import:check')}</Button>
        </Box>

        {done && <Alert severity={done.rejected ? 'warning' : 'success'} sx={{ mb: 2 }}>
          {t('import:done', done)}{done.rejected > 0 && ' ' + t('import:done:rejected', { count: done.rejected })}
        </Alert>}
        {report && Object.keys(report).length > 0 && <>
          <Typography variant='h5' component='h2' sx={{ mt: 1 }}>{t('import:review')}</Typography>
          <Typography color='text.secondary' sx={{ mb: 1.5 }}>{t('import:review:hint')}</Typography>
          <ImportReview guide={guide} report={report} review={review} onChange={(next) => {
            setIsDirty(current => current || next.edits !== review.edits);
            setReview(next);
          }} />
          <Stack sx={{ gap: 1, alignItems: 'flex-start', mb: 4 }}>
            {pending.length > 0 && <>
              <Typography sx={{ fontWeight: 600 }} color='warning.main'>{t('import:pending', { count: pending.length })}</Typography>
              <Button variant='outlined' startIcon={<DoneAll />} onClick={() => setReview({ ...review, confirmed: [ ...review.confirmed, ...pending.map(guess => guess.key) ] })}>
                {t('import:confirm:all', { count: pending.length })}
              </Button>
            </>}
            {isDirty ?
              <Button variant='contained' size='large' startIcon={<Refresh />} loading={recheck.isPending} onClick={() => recheck.mutate()}>{t('import:recheck')}</Button> :
              <Button variant='contained' size='large' startIcon={<FactCheck />} loading={save.isPending} disabled={! count || pending.length > 0} onClick={() => save.mutate()}>
                {t(count ? 'import:save' : 'import:nothing', { count })}
              </Button>}
          </Stack>
        </>}
      </Box>
    </Page>
  );
}
