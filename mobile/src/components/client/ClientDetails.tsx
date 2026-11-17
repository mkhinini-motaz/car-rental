import { Text } from 'react-native';
import Client, { clientName } from '../../classes/Client';
import { formatLocalPhoneNumber } from '../../support/utils';
import TranslatableText from '../common/TranslatableText';
import Card from '../ui/Card';
import InfoRow from '../ui/InfoRow';
import ClientWarning from './ClientWarning';

export default function ClientDetails({ data }: { data: Client }): React.JSX.Element {
  return (
    <Card>
      <Text className='text-title font-semibold text-ink'>{clientName(data)}</Text>
      <ClientWarning clientId={data.id} />
      <InfoRow label='form:phone:label' value={formatLocalPhoneNumber(data.phone)} />
      <InfoRow label='form:gender:label' value={data.gender ? <TranslatableText data={'common:gender:' + data.gender} className='text-body font-semibold text-ink' /> : '—'} />
      <InfoRow label='form:birth_date:label' value={data.birth_date || '—'} />
      <InfoRow label='form:id_number:label' value={data.id_number || '—'} />
      <InfoRow label='form:driver_licence_number:label' value={data.driver_licence_number || '—'} />
      <InfoRow label='form:driver_licence_delivery_date:label' value={data.driver_licence_delivery_date || '—'} />
      <InfoRow label='form:driver_licence_expiry_date:label' value={data.driver_licence_expiry_date || '—'} />
      {data.notes && <>
        <TranslatableText data='client:notes' className='text-meta text-muted' />
        <Text className='text-body text-ink'>{data.notes}</Text>
      </>}
    </Card>
  );
}
