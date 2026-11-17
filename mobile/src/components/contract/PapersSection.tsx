import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateContractQueries, sign } from '../../api/contract';
import Contract, { STATUS_CLOSED } from '../../classes/Contract';
import { useLang } from '../../store/hooks';
import { alertRequestError } from '../../support/alert';
import { pdfLang, usePdf } from '../../support/pdf';
import ChipsField from '../Form/ChipsField';
import TranslatableText from '../common/TranslatableText';
import Card from '../ui/Card';
import Icon from '../ui/Icon';
import ListRow from '../ui/ListRow';
import Tappable from '../ui/Tappable';
import SignatureField from './SignatureField';
import { useColors } from '../../store/ThemeContext';

// The contract and its invoice as PDF (open to print, or share with the client), in French or
// Arabic, and the client's signature when it wasn't taken at pickup.
export default function PapersSection({ data }: { data: Contract }): React.JSX.Element {
  const COLORS = useColors();
  const { selectedLang } = useLang();
  const queryClient = useQueryClient();
  const [lang, setLang] = useState<'fr'|'ar'>(pdfLang(selectedLang));
  const open = usePdf(data.id);
  const signContract = useMutation({
    mutationFn: (signature: string) => sign(data.id, signature),
    onSuccess: () => invalidateContractQueries(queryClient),
    onError: requestError => alertRequestError(selectedLang, requestError),
  });
  const openInvoice = async (share: boolean) => {
    await open('invoice', { lang, share });
    invalidateContractQueries(queryClient); // it has a number now
  };
  const shareIcon = (onPress: () => void) => <Tappable onPress={onPress}><Icon name='share-variant-outline' size={24} color={COLORS.primary} /></Tappable>;

  return (
    <Card>
      <TranslatableText data='papers:title' className='text-title font-semibold text-ink' />
      <ChipsField value={lang} options={[ { label: 'papers:lang:fr', value: 'fr' as const }, { label: 'papers:lang:ar', value: 'ar' as const } ]} onChange={setLang} />
      <ListRow icon='file-document-outline' title={<TranslatableText data='papers:contract' className='text-body text-ink' />} onPress={() => open('contract', { lang })} meta={shareIcon(() => open('contract', { lang, share: true }))} chevron={false} />
      <ListRow
        icon='receipt-text-outline'
        title={<TranslatableText data='papers:invoice' className='text-body text-ink' />}
        subtitle={data.invoice_number ?? undefined}
        onPress={() => openInvoice(false)}
        meta={shareIcon(() => openInvoice(true))}
        chevron={false}
      />
      {data.status !== STATUS_CLOSED && <SignatureField value={data.signature} onChange={signature => signContract.mutate(signature)} />}
    </Card>
  );
}
