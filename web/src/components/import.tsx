import React, { useState } from 'react';
import { Box, Button, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import Check from '@mui/icons-material/Check';
import Close from '@mui/icons-material/Close';
import Edit from '@mui/icons-material/Edit';
import Restore from '@mui/icons-material/Restore';
import {
  COLUMN_HINTS, fixKey, headerKey, IMPORT_KINDS, ImportDataset, ImportGuide, ImportKind, ImportReport, ImportReview as Review, ImportRow, rowKey,
} from '../api/import';
import { COLORS } from '../constants';
import { useLang, useT } from '../store/Store';
import { arrow, plate } from '../support/utils';
import { Section } from './common';

// Every column of a file: what it is, whether it's required, how to write it, an example.
export function ColumnTable({ kind, guide }: { kind: ImportKind, guide: ImportGuide }) {
  const t = useT();
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size='small'>
        <TableHead>
          <TableRow>
            <TableCell>{t('import:table:column')}</TableCell>
            <TableCell>{t('import:table:how')}</TableCell>
            <TableCell>{t('import:table:example')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {guide[kind].columns.map(column =>
            <TableRow key={column.name}>
              <TableCell>
                <Typography sx={{ fontWeight: 600 }}>{t(column.label)}</Typography>
                <Typography variant='body2' color='text.secondary' sx={{ fontFamily: 'monospace' }}>{column.name}</Typography>
                {column.required && <Chip size='small' color='warning' variant='outlined' label={t('import:required')} sx={{ mt: 0.5 }} />}
              </TableCell>
              <TableCell>
                <Typography variant='body2'>{t('import:format:' + column.type)}</Typography>
                {column.options && <Typography variant='body2' color='text.secondary'>{column.options.map(option => option.words[0] + ' (' + t(option.label) + ')').join(', ')}</Typography>}
                {COLUMN_HINTS[kind + '.' + column.name] && <Typography variant='body2' color='text.secondary'>{t(COLUMN_HINTS[kind + '.' + column.name])}</Typography>}
              </TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{column.example ?? '—'}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Box>
  );
}

// Which row it is, as the user knows it: the plate, the name, the plate and the start.
function rowTitle(kind: ImportKind, row: ImportRow): string {
  const cells = row.cells;
  const name = kind === 'cars' ? cells.licence_plate && plate(cells.licence_plate) :
    kind === 'clients' ? [ cells.first_name, cells.last_name ].filter(Boolean).join(' ') :
    [ cells.licence_plate && plate(cells.licence_plate), cells.starts_at ].filter(Boolean).join(' · ');
  return name ?? '';
}

// What a check found in each file, as on the phone: how its columns were read, then each row with a
// guess to confirm or change, an error to fix or a row to leave out. Rows read as they are are counted.
export function ImportReview({ guide, report, review, onChange }: { guide: ImportGuide, report: ImportReport, review: Review, onChange: (review: Review) => void }) {
  const t = useT();
  const { isRtl } = useLang();
  const [editing, setEditing] = useState<string[]>([]); // rowKey:column open for typing
  const [shown, setShown] = useState<string[]>([]); // lists opened: a kind's format fixes, or its columns read (kind:header)

  const label = (kind: ImportKind, column: string) => t(guide[kind].columns.find(item => item.name === column)?.label ?? column);
  const confirm = (key: string) => onChange({ ...review, confirmed: [ ...review.confirmed, key ] });
  const toggleSkip = (key: string) => onChange({ ...review, skipped: review.skipped.includes(key) ? review.skipped.filter(item => item !== key) : [ ...review.skipped, key ] });
  const field = (kind: ImportKind, row: ImportRow, column: string) => {
    const key = rowKey(kind, row) + ':' + column;
    if (! editing.includes(key)) {
      return <Button size='small' variant='outlined' startIcon={<Edit />} onClick={() => setEditing(current => [ ...current, key ])}>{t('import:change')}</Button>;
    }
    return <TextField
      autoFocus
      size='small'
      label={label(kind, column)}
      value={review.edits[rowKey(kind, row)]?.[column] ?? row.cells[column] ?? ''}
      onChange={event => onChange({ ...review, edits: { ...review.edits, [rowKey(kind, row)]: { ...review.edits[rowKey(kind, row)], [column]: event.target.value } } })}
      sx={{ minWidth: 220 }}
    />;
  };

  const dataset = (kind: ImportKind, data: ImportDataset) => {
    const attention = data.rows.filter(row => row.errors.length || row.fixes.some(fix => ! fix.sure) || review.skipped.includes(rowKey(kind, row)));
    const ready = data.rows.length - attention.length;
    const reformatted = data.rows.flatMap(row => row.fixes.filter(fix => fix.sure).map(fix => ({ row, fix })));

    return (
      <Section key={kind} title={'import:kind:' + kind}>
        <Typography variant='body2' color='text.secondary'>{t('import:counts', data.counts)}</Typography>
        {/* Column names read as an alias are listed on demand; a close one is a guess to confirm. */}
        {!! data.header?.fixes.some(fix => fix.sure) && <Stack direction='row' sx={{ gap: 1, alignItems: 'center' }}>
          <Typography variant='body2' color='text.secondary'>{t('import:header:count', { count: data.header.fixes.filter(fix => fix.sure).length })}</Typography>
          {! shown.includes(kind + ':header') && <Button size='small' onClick={() => setShown(current => [ ...current, kind + ':header' ])}>{t('import:reformatted:show')}</Button>}
        </Stack>}
        {data.header?.fixes.filter(fix => ! fix.sure || shown.includes(kind + ':header')).map(fix =>
          <Stack key={fix.from} direction='row' sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant={fix.sure ? 'body2' : 'body1'} color={fix.sure ? 'text.secondary' : undefined}>{t('import:header:read', { from: fix.from, to: label(kind, fix.to) })}</Typography>
            {! fix.sure && (review.confirmed.includes(headerKey(kind, fix.from)) ?
              <Chip size='small' color='success' label={t('import:confirm')} /> :
              <Button size='small' variant='contained' startIcon={<Check />} onClick={() => confirm(headerKey(kind, fix.from))}>{t('import:confirm')}</Button>)}
          </Stack>
        )}
        {!! data.header?.fixes.some(fix => ! fix.sure) && <Typography variant='body2' color='text.secondary'>{t('import:header:guess')}</Typography>}
        {!! data.header?.ignored.length && <Typography variant='body2' color='text.secondary'>{t('import:header:ignored', { columns: data.header.ignored.join(', ') })}</Typography>}
        {!! data.header?.missing.length && <Typography color='error'>{t('import:header:missing', { columns: data.header.missing.map(column => label(kind, column)).join(', ') })}</Typography>}

        {attention.map(row => {
          const key = rowKey(kind, row);
          const isSkipped = review.skipped.includes(key);
          return (
            <Box key={key} sx={{ borderTop: 1, borderColor: 'divider', pt: 1.5, display: 'flex', flexDirection: 'column', gap: 1, opacity: isSkipped ? 0.55 : 1 }}>
              <Stack direction='row' sx={{ gap: 1, alignItems: 'center' }}>
                <Typography sx={{ fontWeight: 600, flex: 1 }}>{t('import:row', { line: row.line })} · {rowTitle(kind, row)}</Typography>
                {isSkipped && <Chip size='small' label={t('import:skipped')} />}
              </Stack>
              {! isSkipped && row.fixes.filter(fix => ! fix.sure).map(fix => {
                const isConfirmed = review.confirmed.includes(fixKey(kind, row, fix));
                const isEdited = review.edits[key]?.[fix.column] !== undefined;
                return (
                  <Box key={fix.column}>
                    <Typography variant='body2' sx={{ fontWeight: 600, color: COLORS.warn }}>{t('import:guess')}</Typography>
                    <Typography>{label(kind, fix.column)} : <bdi>{plate(fix.from ?? t('import:empty'))}</bdi>{arrow(isRtl)}<b><bdi>{plate(fix.to)}</bdi></b></Typography>
                    <Stack direction='row' sx={{ gap: 1, alignItems: 'center', mt: 0.5, flexWrap: 'wrap' }}>
                      {isConfirmed ? <Chip size='small' color='success' label={t('import:confirm')} /> :
                        ! isEdited && <Button size='small' variant='contained' startIcon={<Check />} onClick={() => confirm(fixKey(kind, row, fix))}>{t('import:confirm')}</Button>}
                      {! isConfirmed && field(kind, row, fix.column)}
                    </Stack>
                  </Box>
                );
              })}
              {! isSkipped && row.errors.map(error =>
                <Stack key={error.column + error.code} sx={{ gap: 0.5, alignItems: 'flex-start' }}>
                  <Typography color='error'>{t(error.code, { ...error.params, column: label(kind, error.column) })}</Typography>
                  {field(kind, row, error.column)}
                </Stack>
              )}
              <Box>
                <Button size='small' startIcon={isSkipped ? <Restore /> : <Close />} onClick={() => toggleSkip(key)}>{t(isSkipped ? 'import:unskip' : 'import:skip')}</Button>
              </Box>
            </Box>
          );
        })}

        {ready > 0 && <Typography>{t('import:ready', { count: ready })}</Typography>}
        {reformatted.length > 0 && <Box>
          <Stack direction='row' sx={{ gap: 1, alignItems: 'center' }}>
            <Typography variant='body2' color='text.secondary'>{t('import:reformatted', { count: reformatted.length })}</Typography>
            {! shown.includes(kind) && <Button size='small' onClick={() => setShown(current => [ ...current, kind ])}>{t('import:reformatted:show')}</Button>}
          </Stack>
          {shown.includes(kind) && reformatted.map(({ row, fix }) =>
            <Typography key={row.line + fix.column} variant='body2' color='text.secondary'>{t('import:row', { line: row.line })} · {label(kind, fix.column)} : <bdi>{plate(fix.from ?? '')}</bdi>{arrow(isRtl)}<bdi>{plate(fix.to)}</bdi></Typography>
          )}
        </Box>}
      </Section>
    );
  };

  return <>{IMPORT_KINDS.map(kind => report[kind] && dataset(kind, report[kind]))}</>;
}
