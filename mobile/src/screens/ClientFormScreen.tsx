import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { show, store, update } from '../api/clients';
import { useLang, useNetworkErrorAlert } from '../store/hooks';
import { alertRequestError } from '../support/alert';
import Form from '../components/Form/Form';
import Screen from '../components/ui/Screen';
import FullScreenLoader from '../components/common/FullScreenLoader';
import { ScreenProps } from '../navigation/types';
import {
  clientFormFields, clientServerErrors, clientToForm, ClientFormValue, emptyClientForm, formToClientInput,
} from '../components/client/clientForm';

// Creates a client, or edits one when `clientId` is given.
export default function ClientFormScreen({ route, navigation }: ScreenProps<'ClientFormScreen'>): React.JSX.Element {
  const clientId = route.params?.clientId;
  const { selectedLang } = useLang();
  const queryClient = useQueryClient();
  const [value, setValue] = useState<ClientFormValue>(emptyClientForm);
  const [serverErrors, setServerErrors] = useState({});

  const { isLoading, error, data } = useQuery({ queryKey: ['client.show', { id: clientId }], queryFn: show, enabled: !! clientId });
  useNetworkErrorAlert(error);
  useEffect(() => {
    if (data) {
      setValue(clientToForm(data));
    }
  }, [data]);

  const { mutate, isPending } = useMutation({
    mutationFn: () => clientId ? update(clientId, formToClientInput(value)) : store(formToClientInput(value)),
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: ['client.index'] });
      queryClient.invalidateQueries({ queryKey: ['client.show', { id: client.id }] });
      queryClient.invalidateQueries({ queryKey: ['contract.index'] });
      queryClient.invalidateQueries({ queryKey: ['contract.show'] }); // pickup checks the client's details
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      if (clientId) {
        navigation.goBack();
      } else {
        navigation.replace('ClientScreen', { clientId: client.id });
      }
    },
    onError: (requestError) => {
      const errors = clientServerErrors(requestError);
      setServerErrors(errors);
      if (! Object.keys(errors).length) {
        alertRequestError(selectedLang, requestError);
      }
    },
  });

  if (clientId && isLoading) {
    return <FullScreenLoader />;
  }

  return (
    <Screen white>
      <Form
        value={value}
        fields={clientFormFields(isPending)}
        onChange={setValue}
        onSubmit={() => {
          setServerErrors({});
          mutate();
        }}
        serverErrors={serverErrors}
      />
    </Screen>
  );
}
