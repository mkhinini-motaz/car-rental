import { useState } from 'react';
import { Linking, Share, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { errorCodes, isErrorWithCode, keepLocalCopy, pick, types } from '@react-native-documents/picker';
import {
  checkFiles, checkRows, COLUMN_HINTS, emptyReview, guide as fetchGuide, IMPORT_KINDS, importableCount, ImportColumn, ImportKind, ImportReport,
  pendingGuesses, rowsToSend,
} from '../api/import';
import { invalidateContractQueries } from '../api/contract';
import { MONEY_QUERIES } from '../api/money';
import { useLang, useNetworkErrorAlert, useT } from '../store/hooks';
import { alertMessage, alertRequestError, validationErrors } from '../support/alert';
import FullScreenLoader from '../components/common/FullScreenLoader';
import LangAwareView from '../components/common/LangAwareView';
import TranslatableText from '../components/common/TranslatableText';
import ImportReview from '../components/import/ImportReview';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import ErrorState from '../components/ui/ErrorState';
import KeyboardScroll from '../components/ui/KeyboardScroll';
import Screen from '../components/ui/Screen';
import { useColors } from '../store/ThemeContext';

interface PickedFile { uri: string, name: string, type: string }

// One column of a file's guide: its label, whether it's required, how to write it, an example.
function ColumnGuide({ kind, column }: { kind: ImportKind, column: ImportColumn }): React.JSX.Element {
  const t = useT();
  return (
    <View style={{ gap: 2, paddingVertical: 4 }}>
      <LangAwareView style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Text className='text-body font-semibold text-ink'>{t(column.label)}</Text>
        <Text className='text-meta text-muted'>{column.name}</Text>
        {column.required && <Badge label='import:required' tone='warn' />}
      </LangAwareView>
      <TranslatableText data={'import:format:' + column.type} className='text-meta text-muted' />
      {column.options && <Text className='text-meta text-muted'>{column.options.map(option => option.words[0] + ' (' + t(option.label) + ')').join(', ')}</Text>}
      {COLUMN_HINTS[kind + '.' + column.name] && <TranslatableText data={COLUMN_HINTS[kind + '.' + column.name]} className='text-meta text-muted' />}
      {column.example && <TranslatableText data='import:example' params={{ value: column.example }} className='text-meta text-muted' />}
    </View>
  );
}

// The owner brings the agency's cars, clients and rentals in from spreadsheets: a guide and a template
// per file, then a check that fixes what it can and asks about its guesses, then the import.
export default function ImportScreen(): React.JSX.Element {
  const t = useT();
  const COLORS = useColors();
  const { selectedLang } = useLang();
  const queryClient = useQueryClient();
  const { isLoading, error, data: guide, refetch } = useQuery({ queryKey: ['import.guide'], queryFn: fetchGuide });
  useNetworkErrorAlert(error);
  const [files, setFiles] = useState<Partial<Record<ImportKind, PickedFile>>>({});
  const [open, setOpen] = useState<ImportKind[]>([]); // kinds whose columns are listed
  const [report, setReport] = useState<ImportReport|null>(null);
  const [review, setReview] = useState(emptyReview);
  const [isDirty, setIsDirty] = useState(false); // cells changed since the last check
  const [done, setDone] = useState<{ new: number, updated: number, unchanged: number, rejected: number }|null>(null);

  // What the API said about the file itself (an .xlsx, no rows), by file.
  const onFileError = (requestError: any) => {
    const errors = validationErrors(requestError);
    const messages = IMPORT_KINDS.filter(kind => errors['files.' + kind]).map(kind => t('import:kind:' + kind) + ' : ' + t(errors['files.' + kind][0]));
    messages.length ? alertMessage(selectedLang, messages.join('\n')) : alertRequestError(selectedLang, requestError);
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
  const recheck = useMutation({ mutationFn: () => checkRows(rowsToSend(report!, review)), onSuccess: reviewed, onError: (requestError) => alertRequestError(selectedLang, requestError) });
  const save = useMutation({
    mutationFn: () => checkRows(rowsToSend(report!, review), true),
    onSuccess: (result) => {
      invalidateContractQueries(queryClient);
      [ ...MONEY_QUERIES, 'client.index' ].forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
      const counts = { new: 0, updated: 0, unchanged: 0, rejected: 0 };
      Object.values(result).forEach(dataset => (Object.keys(counts) as (keyof typeof counts)[]).forEach(key => counts[key] += dataset.counts[key]));
      setDone(counts);
      setFiles({});
      // What was saved is done; what wasn't stays to fix and import again.
      reviewed(Object.fromEntries(Object.entries(result).filter(([ , dataset ]) => dataset.counts.rejected).map(([ kind, dataset ]) => [ kind, {
        ...dataset, rows: dataset.rows.filter(row => row.result === 'rejected'), header: undefined,
        counts: { new: 0, updated: 0, unchanged: 0, rejected: dataset.counts.rejected },
      } ])));
    },
    onError: (requestError) => alertRequestError(selectedLang, requestError),
  });

  const choose = async (kind: ImportKind) => {
    try {
      const [ file ] = await pick({ type: [ types.allFiles ] }); // an .xlsx too, for the API to say what to do
      const name = file.name ?? kind + '.csv';
      const [ copy ] = await keepLocalCopy({ files: [ { uri: file.uri, fileName: name } ], destination: 'cachesDirectory' });
      setFiles(current => ({ ...current, [kind]: { uri: copy.status === 'success' ? copy.localUri : file.uri, name, type: file.type ?? 'text/csv' } }));
    } catch (pickError) {
      if (! (isErrorWithCode(pickError) && pickError.code === errorCodes.OPERATION_CANCELED)) {
        alertMessage(selectedLang, 'common:error:happened');
      }
    }
  };

  if (isLoading) {
    return <FullScreenLoader />;
  }
  if (! guide) {
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }
  const pending = report ? pendingGuesses(report, review) : [];
  const count = report ? importableCount(report, review) : 0;

  return (
    <Screen>
      <KeyboardScroll contentContainerStyle={{ paddingBottom: 32 }}>
        <Card>
          <TranslatableText data='import:intro' className='text-body text-ink' />
          <TranslatableText data='import:how' className='text-title font-semibold text-ink' />
          {[ 1, 2, 3, 4 ].map(step =>
            <LangAwareView key={step} style={{ gap: 8 }}>
              <Text className='text-body font-semibold text-ink'>{step}.</Text>
              <TranslatableText data={'import:step:' + step} className='text-body text-ink' style={{ flex: 1 }} />
            </LangAwareView>
          )}
          <TranslatableText data='import:order' className='text-meta text-muted' />
          <TranslatableText data='import:again' className='text-meta text-muted' />
        </Card>

        {IMPORT_KINDS.map(kind =>
          <Card key={kind}>
            <TranslatableText data={'import:kind:' + kind} className='text-title font-semibold text-ink' />
            <TranslatableText data={'import:kind:' + kind + ':hint'} className='text-body text-muted' />
            <LangAwareView style={{ gap: 8 }}>
              <View style={{ flex: 1 }}><Button compact variant='secondary' icon='download' label='import:template' onPress={() => Linking.openURL(guide[kind].template_url)} /></View>
              <View style={{ flex: 1 }}><Button compact variant='secondary' icon='share-variant' label='import:template:share' onPress={() => Share.share({ message: t('import:template:message', { kind: t('import:kind:' + kind), url: guide[kind].template_url }) })} /></View>
            </LangAwareView>
            {open.includes(kind) ?
              guide[kind].columns.map(column => <ColumnGuide key={column.name} kind={kind} column={column} />) :
              <Button compact variant='secondary' icon='table-column' label='import:columns' onPress={() => setOpen(current => [ ...current, kind ])} />}
            <LangAwareView style={{ gap: 8, alignItems: 'center', borderTopWidth: 1, borderColor: COLORS.line, paddingTop: 8 }}>
              <Text className='text-body text-ink' style={{ flex: 1 }} numberOfLines={1}>{files[kind]?.name ?? t('import:file:none')}</Text>
              <Button compact icon='file-document-outline' label='import:file:choose' onPress={() => choose(kind)} />
            </LangAwareView>
          </Card>
        )}
        <View className='mx-3 my-1.5'>
          <Button icon='magnify' label='import:check' isLoading={check.isPending} disabled={! Object.keys(files).length} onPress={() => check.mutate()} />
        </View>

        {done && <Card>
          <TranslatableText data='import:done' params={done} className='text-body font-semibold' style={{ color: COLORS.ok }} />
          {done.rejected > 0 && <TranslatableText data='import:done:rejected' params={{ count: done.rejected }} className='text-body text-ink' />}
        </Card>}
        {report && Object.keys(report).length > 0 && <>
          <View className='mx-4 mt-3 gap-y-1'>
            <TranslatableText data='import:review' className='text-title font-semibold text-ink' />
            <TranslatableText data='import:review:hint' className='text-body text-muted' />
          </View>
          <ImportReview guide={guide} report={report} review={review} onChange={(next) => {
            setIsDirty(current => current || next.edits !== review.edits);
            setReview(next);
          }} />
          <View className='mx-3 my-1.5 gap-y-2'>
            {pending.length > 0 && <>
              <TranslatableText data='import:pending' params={{ count: pending.length }} className='text-body font-semibold' style={{ color: COLORS.warn }} />
              <Button variant='secondary' icon='check-all' label='import:confirm:all' params={{ count: pending.length }} onPress={() => setReview({ ...review, confirmed: [ ...review.confirmed, ...pending.map(guess => guess.key) ] })} />
            </>}
            {isDirty ?
              <Button icon='refresh' label='import:recheck' isLoading={recheck.isPending} onPress={() => recheck.mutate()} /> :
              <Button icon='database-import' label={count ? 'import:save' : 'import:nothing'} params={{ count }} isLoading={save.isPending} disabled={! count || pending.length > 0} onPress={() => save.mutate()} />}
          </View>
        </>}
      </KeyboardScroll>
    </Screen>
  );
}
