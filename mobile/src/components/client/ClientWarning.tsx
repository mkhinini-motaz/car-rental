import { Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { show } from '../../api/clients';
import { BADGE_TONES } from '../../classes/Client';
import { useMoney, useT } from '../../store/hooks';
import LangAwareView from '../common/LangAwareView';
import TranslatableText from '../common/TranslatableText';
import Badge from '../ui/Badge';
import Icon from '../ui/Icon';
import Tappable from '../ui/Tappable';
import { useOpen } from '../../support/useOpen';
import { useColors } from '../../store/ThemeContext';

// What staff must know before renting to this person: blacklisted (flagged themselves, or the same
// phone, ID card or licence as a flagged client: people change numbers), and with `withBadge`, how
// reliable they have been (badge, balance, late returns), and the agency's rules they break (age,
// licence). Nothing for a clean new client.
export default function ClientWarning({ clientId, withBadge = true }: { clientId?: number|null, withBadge?: boolean }): React.JSX.Element|null {
  const COLORS = useColors();
  const t = useT();
  const money = useMoney();
  const open = useOpen();
  const { data } = useQuery({ queryKey: ['client.show', { id: clientId }], queryFn: show, enabled: !! clientId });
  const stats = data?.stats;
  const showsBadge = withBadge && stats && stats.badge !== 'new';
  const issues = data?.eligibility ?? [];
  if (! data?.warnings?.length && ! showsBadge && ! issues.length) {
    return null;
  }

  return (
    <View style={{ gap: 8 }}>
      {showsBadge && <LangAwareView style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Badge label={'client:badge:' + stats.badge} tone={BADGE_TONES[stats.badge]} />
        <Text className='text-meta text-muted'>{[
          t('client:stats:rentals', { count: stats.contracts_count + stats.rentals_before }), // with those on paper
          stats.outstanding ? t('client:stats:owes', { amount: money(stats.outstanding) }) : null,
          stats.late_returns ? t('client:stats:late', { count: stats.late_returns }) : null,
          stats.fines_unpaid ? t('client:stats:fines', { amount: money(stats.fines_unpaid) }) : null,
        ].filter(Boolean).join(' · ')}</Text>
      </LangAwareView>}
      {issues.map(issue =>
        <LangAwareView key={issue.code} style={{ gap: 8, alignItems: 'center' }}>
          <Icon name='card-account-details-outline' size={20} color={COLORS.warn} />
          <TranslatableText data={'client:eligibility:' + issue.code} params={issue} className='text-body font-semibold' style={{ color: COLORS.warn, flex: 1 }} />
        </LangAwareView>
      )}
      {!! data?.warnings?.length && <View style={{ gap: 4, padding: 12, borderRadius: 12, backgroundColor: COLORS.danger + '12', borderWidth: 1, borderColor: COLORS.danger }}>
        {data.warnings.map(warning =>
          <Tappable key={warning.id} onPress={warning.matched_on.includes('self') ? undefined : () => open.client(warning.id)}>
            <View><LangAwareView style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Icon name='alert-octagon' size={20} color={COLORS.danger} />
              <TranslatableText data={'client:flag:' + warning.flag} className='text-body font-semibold text-danger' />
              {! warning.matched_on.includes('self') && <TranslatableText
                data='client:flag:match'
                params={{ name: warning.first_name + ' ' + warning.last_name, fields: warning.matched_on.map(field => t('client:matched:' + field)).join(', ') }}
                className='text-meta text-danger'
              />}
            </LangAwareView>
            {warning.notes && <Text className='text-meta text-ink'>{warning.notes}</Text>}
          </View></Tappable>
        )}
      </View>}
    </View>
  );
}
