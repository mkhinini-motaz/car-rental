import { useLayoutEffect, useMemo, useState } from 'react';
import { FlatList, TextInput, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { index } from '../api/clients';
import { useLang, useNetworkErrorAlert, useT } from '../store/hooks';
import { debounce } from '../support/utils';
import ClientRow from '../components/client/ClientRow';
import FullScreenLoader from '../components/common/FullScreenLoader';
import LangAwareView from '../components/common/LangAwareView';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import Icon from '../components/ui/Icon';
import Screen from '../components/ui/Screen';
import { TabProps } from '../navigation/types';
import { useColors } from '../store/ThemeContext';

export default function ClientsScreen({ navigation }: TabProps<'Clients'>): React.JSX.Element {
  const COLORS = useColors();
  const { selectedLangWriteFrom } = useLang();
  const t = useT();
  const [searchValue, setSearchValue] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSetSearch = useMemo(() => debounce(setSearch, 500), []);
  const { isLoading, error, data, refetch } = useQuery({ queryKey: ['client.index', { search }], queryFn: index });
  useNetworkErrorAlert(error);
  const newClient = () => navigation.navigate('ClientFormScreen');
  useLayoutEffect(() => navigation.setOptions({
    headerRight: () => <TouchableOpacity onPress={newClient} hitSlop={10} style={{ marginHorizontal: 16 }}>
      <Icon name='account-plus' size={28} color={COLORS.onNav} />
    </TouchableOpacity>,
  }));

  return (
    <Screen>
      <LangAwareView style={{ alignItems: 'center', gap: 8, marginHorizontal: 12, marginTop: 12, marginBottom: 4, paddingHorizontal: 12, height: 44, borderRadius: 10, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.surface }}>
        <Icon name='magnify' size={20} color={COLORS.muted} />
        <TextInput
          value={searchValue}
          placeholder={t('client:search')}
          placeholderTextColor={COLORS.muted}
          onChangeText={(newValue) => {
            setSearchValue(newValue);
            debouncedSetSearch(newValue);
          }}
          style={{ flex: 1, fontSize: 16, color: COLORS.ink, paddingVertical: 0 }}
          textAlign={selectedLangWriteFrom}
        />
      </LangAwareView>
      {isLoading ? <FullScreenLoader /> :
        ! data ? <ErrorState error={error} onRetry={() => refetch()} /> :
        <FlatList
          data={data}
          contentContainerStyle={{ paddingBottom: 8 }}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <ClientRow data={item} onPress={() => navigation.navigate('ClientScreen', { clientId: item.id })} />}
          ListEmptyComponent={<EmptyState icon='account-search-outline' label={search ? 'common:no_data' : 'client:none'} action={{ label: 'client:new', onPress: newClient }} />}
          keyboardShouldPersistTaps='handled'
        />
      }
    </Screen>
  );
}
