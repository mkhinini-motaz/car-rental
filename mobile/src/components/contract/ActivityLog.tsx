import { Text, View } from 'react-native';
import Activity from '../../classes/Activity';
import { Extra } from '../../classes/Contract';
import { translate } from '../../i18n';
import { useLang } from '../../store/hooks';
import { arrow, formatDateTime, formatMoneyDisplay } from '../../support/utils';
import Card from '../ui/Card';
import TranslatableText from '../common/TranslatableText';

const MONEY_FIELDS = [ 'daily_price', 'deposit', 'deposit_kept', 'amount', 'charges', 'commission' ];
const TIME_FIELDS = [ 'starts_at', 'ends_at' ];

// Who did what to the contract and its payments, or to a staff account, newest first.
export default function ActivityLog({ activities }: { activities?: Activity[] }): React.JSX.Element|null {
  const { selectedLang, selectedLangWriteFrom } = useLang();
  if (! activities?.length) {
    return null;
  }

  const format = (field: string, value: any): string => {
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    if (MONEY_FIELDS.includes(field)) {
      return formatMoneyDisplay(value, selectedLang);
    }
    if (TIME_FIELDS.includes(field)) {
      return formatDateTime(value);
    }
    if (field === 'method') {
      return translate('payment:method:' + value, selectedLang);
    }
    if (field === 'role') {
      return translate('staff:role:' + value, selectedLang);
    }
    if (field === 'source') {
      return translate('contract:source:' + value, selectedLang);
    }
    if (field === 'extras') {
      return (value as Extra[]).map(extra => extra.name).join(', ') || '—';
    }
    if (field === 'mileage') {
      return value + ' km';
    }
    return String(value);
  };
  const label = (field: string) => translate('activity:field:' + field, selectedLang);

  const details = (activity: Activity): string[] => Object.entries(activity.changes ?? {})
    .filter(([ field, value ]) => ! (field === 'charges' && ! value) && ! (field === 'deposit_kept' && ! value) && field !== 'deposit_kept_reason')
    .map(([ field, value ]) => activity.action === 'updated' ?
      label(field) + ' : ' + format(field, value[0]) + arrow(selectedLangWriteFrom) + format(field, value[1]) :
      label(field) + ' : ' + format(field, value) + (field === 'deposit_kept' && activity.changes?.deposit_kept_reason ? ' (' + activity.changes.deposit_kept_reason + ')' : ''));

  return (
    <Card>
      <TranslatableText data='activity:label' className='text-title font-semibold text-ink' />
      {activities.map(activity =>
        <View key={activity.id} className='border-l-2 border-line pl-2'>
          <TranslatableText
            data='activity:by'
            params={{ action: translate('activity:' + activity.action, selectedLang), user: activity.user ? activity.user.first_name + ' ' + activity.user.last_name : '—', date: formatDateTime(activity.created_at) }}
            className='text-body font-semibold text-ink'
          />
          {details(activity).map((line, index) => <Text key={index} className='text-meta text-muted'>{line}</Text>)}
        </View>
      )}
    </Card>
  );
}
