import { Linking } from 'react-native';
import { useAgency } from '../../api/agency';
import Contract from '../../classes/Contract';
import { checkinLink } from '../../api/contract';
import { useLang, useMoney, useT } from '../../store/hooks';
import { alertRequestError } from '../../support/alert';
import { messagesFor, messageText, whatsappUrl } from '../../support/whatsapp';
import TranslatableText from '../common/TranslatableText';
import Button from '../ui/Button';
import Card from '../ui/Card';

// The booking confirmation, the check-in link and the pickup or return reminder, ready to send from WhatsApp.
export default function WhatsAppSection({ data }: { data: Contract }): React.JSX.Element|null {
  const t = useT();
  const money = useMoney();
  const { selectedLang } = useLang();
  const { data: agency } = useAgency();
  const kinds = messagesFor(data);
  if (! data.client || ! kinds.length) {
    return null;
  }

  return (
    <Card>
      <TranslatableText data='whatsapp:title' className='text-title font-semibold text-ink' />
      {kinds.map(kind => <Button
        key={kind}
        label={'whatsapp:send:' + kind}
        variant='secondary'
        icon='whatsapp'
        onPress={async () => {
          try {
            const link = kind === 'checkin' ? await checkinLink(data.id) : '';
            await Linking.openURL(whatsappUrl(data.client!.phone, messageText(kind, data, agency, t, money, link)));
          } catch (error) {
            alertRequestError(selectedLang, error);
          }
        }}
      />)}
    </Card>
  );
}
