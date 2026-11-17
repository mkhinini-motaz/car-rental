import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import {
  fixKey, headerKey, IMPORT_KINDS, ImportDataset, ImportGuide, ImportKind, ImportReport, ImportReview as Review, ImportRow, rowKey,
} from '../../api/import';
import { useLang, useT } from '../../store/hooks';
import { arrow, plate } from '../../support/utils';
import { useColors } from '../../store/ThemeContext';
import { useFieldStyles } from '../Form/fieldStyles';
import LangAwareView from '../common/LangAwareView';
import TranslatableText from '../common/TranslatableText';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Card from '../ui/Card';

interface ImportReviewProps {
  guide: ImportGuide,
  report: ImportReport,
  review: Review,
  onChange: (review: Review) => void,
}

// Which row it is, as the user knows it: the plate, the name, the plate and the start.
function rowTitle(kind: ImportKind, row: ImportRow): string {
  const cells = row.cells;
  const name = kind === 'cars' ? cells.licence_plate && plate(cells.licence_plate) :
    kind === 'clients' ? [ cells.first_name, cells.last_name ].filter(Boolean).join(' ') :
    [ cells.licence_plate && plate(cells.licence_plate), cells.starts_at ].filter(Boolean).join(' · ');
  return name ?? '';
}

// What a check found in each file: how its columns were read, then each row with a guess to confirm or
// change, an error to fix or a row to leave out. Rows read as they are and format fixes are counted.
export default function ImportReview({ guide, report, review, onChange }: ImportReviewProps): React.JSX.Element {
  const t = useT();
  const COLORS = useColors();
  const fieldStyles = useFieldStyles();
  const { selectedLangWriteFrom } = useLang();
  const [editing, setEditing] = useState<string[]>([]); // rowKey:column open for typing
  const [shown, setShown] = useState<string[]>([]); // lists opened: a kind's format fixes, or its columns read (kind:header)

  const label = (kind: ImportKind, column: string) => t(guide[kind].columns.find(item => item.name === column)?.label ?? column);
  const confirm = (key: string) => onChange({ ...review, confirmed: [ ...review.confirmed, key ] });
  const edit = (kind: ImportKind, row: ImportRow, column: string, value: string) => onChange({
    ...review, edits: { ...review.edits, [rowKey(kind, row)]: { ...review.edits[rowKey(kind, row)], [column]: value } },
  });
  const toggleSkip = (key: string) => onChange({ ...review, skipped: review.skipped.includes(key) ? review.skipped.filter(item => item !== key) : [ ...review.skipped, key ] });
  const field = (kind: ImportKind, row: ImportRow, column: string) => {
    const key = rowKey(kind, row) + ':' + column;
    if (! editing.includes(key)) {
      return <Button compact variant='secondary' icon='pencil' label='import:change' onPress={() => setEditing(current => [ ...current, key ])} />;
    }
    return <TextInput
      autoFocus
      value={review.edits[rowKey(kind, row)]?.[column] ?? row.cells[column] ?? ''}
      onChangeText={(value) => edit(kind, row, column, value)}
      placeholder={label(kind, column)}
      textAlign={selectedLangWriteFrom}
      style={{ ...fieldStyles.input, flex: 1 }}
    />;
  };

  const dataset = (kind: ImportKind, data: ImportDataset) => {
    const attention = data.rows.filter(row => row.errors.length || row.fixes.some(fix => ! fix.sure) || review.skipped.includes(rowKey(kind, row)));
    const ready = data.rows.length - attention.length;
    const reformatted = data.rows.flatMap(row => row.fixes.filter(fix => fix.sure).map(fix => ({ row, fix })));

    return (
      <Card key={kind}>
        <TranslatableText data={'import:kind:' + kind} className='text-title font-semibold text-ink' />
        <TranslatableText data='import:counts' params={data.counts} className='text-meta text-muted' />
        {/* Column names read as an alias are listed on demand; a close one is a guess to confirm. */}
        {!! data.header?.fixes.some(fix => fix.sure) && <LangAwareView style={{ gap: 8, alignItems: 'center' }}>
          <TranslatableText data='import:header:count' params={{ count: data.header.fixes.filter(fix => fix.sure).length }} className='text-meta text-muted' style={{ flex: 1 }} />
          {! shown.includes(kind + ':header') && <Button compact variant='secondary' label='import:reformatted:show' onPress={() => setShown(current => [ ...current, kind + ':header' ])} />}
        </LangAwareView>}
        {data.header?.fixes.filter(fix => ! fix.sure || shown.includes(kind + ':header')).map(fix =>
          <LangAwareView key={fix.from} style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <TranslatableText data='import:header:read' params={{ from: fix.from, to: label(kind, fix.to) }} className={fix.sure ? 'text-meta text-muted' : 'text-body text-ink'} style={{ flex: 1 }} />
            {! fix.sure && (review.confirmed.includes(headerKey(kind, fix.from)) ?
              <Badge label='import:confirm' tone='ok' /> :
              <Button compact icon='check' label='import:confirm' onPress={() => confirm(headerKey(kind, fix.from))} />)}
          </LangAwareView>
        )}
        {!! data.header?.fixes.some(fix => ! fix.sure) && <TranslatableText data='import:header:guess' className='text-meta text-muted' />}
        {!! data.header?.ignored.length && <TranslatableText data='import:header:ignored' params={{ columns: data.header.ignored.join(', ') }} className='text-meta text-muted' />}
        {!! data.header?.missing.length && <TranslatableText data='import:header:missing' params={{ columns: data.header.missing.map(column => label(kind, column)).join(', ') }} className='text-body text-danger' />}

        {attention.map(row => {
          const key = rowKey(kind, row);
          const isSkipped = review.skipped.includes(key);
          return (
            <View key={key} style={{ borderTopWidth: 1, borderColor: COLORS.line, paddingTop: 8, gap: 6, opacity: isSkipped ? 0.5 : 1 }}>
              <LangAwareView style={{ gap: 8, alignItems: 'center' }}>
                <Text className='text-body font-semibold text-ink' style={{ flex: 1 }}>{t('import:row', { line: row.line })} · {rowTitle(kind, row)}</Text>
                {isSkipped && <Badge label='import:skipped' />}
              </LangAwareView>
              {! isSkipped && row.fixes.filter(fix => ! fix.sure).map(fix => {
                const isConfirmed = review.confirmed.includes(fixKey(kind, row, fix));
                const isEdited = review.edits[key]?.[fix.column] !== undefined;
                return (
                  <View key={fix.column} style={{ gap: 4 }}>
                    <TranslatableText data='import:guess' className='text-meta font-semibold' style={{ color: COLORS.warn }} />
                    <Text className='text-body text-ink'>{label(kind, fix.column)} : {plate(fix.from ?? t('import:empty')) + arrow(selectedLangWriteFrom) + plate(fix.to)}</Text>
                    <LangAwareView style={{ gap: 8, alignItems: 'center' }}>
                      {isConfirmed ? <Badge label='import:confirm' tone='ok' /> :
                        ! isEdited && <Button compact icon='check' label='import:confirm' onPress={() => confirm(fixKey(kind, row, fix))} />}
                      {! isConfirmed && field(kind, row, fix.column)}
                    </LangAwareView>
                  </View>
                );
              })}
              {! isSkipped && row.errors.map(error =>
                <View key={error.column + error.code} style={{ gap: 4 }}>
                  <Text className='text-body text-danger'>{t(error.code, { ...error.params, column: label(kind, error.column) })}</Text>
                  <LangAwareView style={{ gap: 8, alignItems: 'center' }}>{field(kind, row, error.column)}</LangAwareView>
                </View>
              )}
              <View style={{ alignSelf: 'flex-start' }}>
                <Button compact variant='secondary' icon={isSkipped ? 'restore' : 'close'} label={isSkipped ? 'import:unskip' : 'import:skip'} onPress={() => toggleSkip(key)} />
              </View>
            </View>
          );
        })}

        {ready > 0 && <TranslatableText data='import:ready' params={{ count: ready }} className='text-body text-ink' />}
        {reformatted.length > 0 && <>
          <LangAwareView style={{ gap: 8, alignItems: 'center' }}>
            <TranslatableText data='import:reformatted' params={{ count: reformatted.length }} className='text-meta text-muted' style={{ flex: 1 }} />
            {! shown.includes(kind) && <Button compact variant='secondary' label='import:reformatted:show' onPress={() => setShown(current => [ ...current, kind ])} />}
          </LangAwareView>
          {shown.includes(kind) && reformatted.map(({ row, fix }) =>
            <Text key={row.line + fix.column} className='text-meta text-muted'>{t('import:row', { line: row.line })} · {label(kind, fix.column)} : {plate(fix.from ?? '') + arrow(selectedLangWriteFrom) + plate(fix.to)}</Text>
          )}
        </>}
      </Card>
    );
  };

  return <>{IMPORT_KINDS.map(kind => report[kind] && dataset(kind, report[kind]))}</>;
}
