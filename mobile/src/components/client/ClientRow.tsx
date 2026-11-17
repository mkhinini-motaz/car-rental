import Client, { clientName } from '../../classes/Client';
import { formatLocalPhoneNumber } from '../../support/utils';
import Badge from '../ui/Badge';
import ListRow from '../ui/ListRow';
import { useColors } from '../../store/ThemeContext';

// A client in a list: name, phone, and the blacklist flag if any.
export default function ClientRow({ data, onPress, boxed = true }: { data: Client, onPress?: () => void, boxed?: boolean }): React.JSX.Element {
  const COLORS = useColors();
  return (
    <ListRow
      boxed={boxed}
      icon='account-circle-outline'
      iconColor={data.flag ? COLORS.danger : COLORS.muted}
      title={clientName(data)}
      subtitle={formatLocalPhoneNumber(data.phone)}
      meta={data.flag ? <Badge label={'client:flag:' + data.flag} tone='danger' /> : undefined}
      onPress={onPress}
    />
  );
}
