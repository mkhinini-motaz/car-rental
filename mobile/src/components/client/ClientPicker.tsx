import React, { useMemo, useState } from 'react';
import { FlatList, Modal, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Client from '../../classes/Client';
import { index, store } from '../../api/clients';
import { useLang, useNetworkErrorAlert, useT } from '../../store/hooks';
import { alertRequestError } from '../../support/alert';
import { debounce } from '../../support/utils';
import Form from '../Form/Form';
import { useFieldStyles } from '../Form/fieldStyles';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import Icon from '../ui/Icon';
import LangAwareView from '../common/LangAwareView';
import TranslatableText from '../common/TranslatableText';
import ClientRow from './ClientRow';
import { useOpen } from '../../support/useOpen';
import { clientFormFields, clientServerErrors, ClientFormValue, emptyClientForm, formToClientInput } from './clientForm';
import { useColors } from '../../store/ThemeContext';

interface ClientPickerProps {
  value: Client|null,
  onChange: (client: Client) => void,
  onClear?: () => void, // shows a remove button (optional pickers, like the second driver)
  label?: string,
  error?: boolean,
}

// Pick an existing client by name or phone, or create one on the spot with just a name and phone.
export default function ClientPicker({ value, onChange, onClear, label = 'client:label', error = false }: ClientPickerProps): React.JSX.Element {
  const fieldStyles = useFieldStyles();
  const COLORS = useColors();
  const { selectedLang, selectedLangWriteFrom } = useLang();
  const t = useT();
  const open = useOpen();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [search, setSearch] = useState('');
  const [newClient, setNewClient] = useState<ClientFormValue>(emptyClientForm);
  const [serverErrors, setServerErrors] = useState({});
  const debouncedSetSearch = useMemo(() => debounce(setSearch, 500), []);

  const { data, error: queryError } = useQuery({ queryKey: ['client.index', { search }], queryFn: index, enabled: isOpen });
  useNetworkErrorAlert(queryError);

  const close = () => {
    setIsOpen(false);
    setIsCreating(false);
    setSearchValue('');
    setSearch('');
    setNewClient(emptyClientForm);
    setServerErrors({});
  };
  const select = (client: Client) => {
    onChange(client);
    close();
  };

  const { mutate, isPending } = useMutation({
    mutationFn: () => store(formToClientInput(newClient)),
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: ['client.index'] });
      select(client);
    },
    onError: (requestError) => {
      const errors = clientServerErrors(requestError);
      setServerErrors(errors);
      if (! Object.keys(errors).length) {
        alertRequestError(selectedLang, requestError);
      }
    },
  });

  return (
    <View style={{ gap: 6 }}>
      <LangAwareView style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <TranslatableText data={label} style={fieldStyles.label} />
        <LangAwareView style={{ gap: 14, alignItems: 'center' }}>
          {value && <TouchableOpacity onPress={() => open.client(value.id)} hitSlop={8}>
            <Icon name='account-arrow-right-outline' size={22} color={COLORS.primary} />
          </TouchableOpacity>}
          {value && onClear && <TouchableOpacity onPress={onClear} hitSlop={8}>
            <Icon name='close-circle-outline' size={22} color={COLORS.danger} />
          </TouchableOpacity>}
        </LangAwareView>
      </LangAwareView>
      {value ?
        <View style={{ borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, overflow: 'hidden' }}>
          <ClientRow data={value} onPress={() => setIsOpen(true)} boxed={false} />
        </View> :
        <View style={error ? { borderRadius: 12, borderWidth: 2, borderColor: COLORS.danger } : undefined}>
          <Button label='client:choose' variant='secondary' icon='account-search-outline' onPress={() => setIsOpen(true)} />
        </View>
      }

      <Modal animationType='slide' visible={isOpen} onRequestClose={close}>
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.canvas }}>
          <LangAwareView style={{ alignItems: 'center', gap: 8, padding: 12 }}>
            <View style={{ flex: 1 }}>
              {isCreating ?
                <TranslatableText data='client:new' className='text-title font-semibold text-ink' /> :
                <TextInput
                  value={searchValue}
                  placeholder={t('client:search')}
                  placeholderTextColor={COLORS.muted}
                  onChangeText={(newValue) => {
                    setSearchValue(newValue);
                    debouncedSetSearch(newValue);
                  }}
                  style={fieldStyles.input}
                  textAlign={selectedLangWriteFrom}
                  autoFocus
                />
              }
            </View>
            <TouchableOpacity onPress={close} hitSlop={10}>
              <Icon name='close' size={26} color={COLORS.ink} />
            </TouchableOpacity>
          </LangAwareView>

          {isCreating ?
            <Form
              value={newClient}
              fields={clientFormFields(isPending, false)}
              onChange={setNewClient}
              onSubmit={() => {
                setServerErrors({});
                mutate();
              }}
              serverErrors={serverErrors}
            /> :
            <>
              <View style={{ paddingHorizontal: 12, paddingBottom: 6 }}>
                <Button label='client:new' variant='secondary' icon='account-plus' onPress={() => setIsCreating(true)} />
              </View>
              <FlatList
                style={{ flex: 1 }}
                data={data}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => <ClientRow data={item} onPress={() => select(item)} />}
                ListEmptyComponent={data ? <EmptyState icon='account-search-outline' label='common:no_data' /> : undefined}
                keyboardShouldPersistTaps='handled'
              />
            </>
          }
        </SafeAreaView>
      </Modal>
    </View>
  );
}
