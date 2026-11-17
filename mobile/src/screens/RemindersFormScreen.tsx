import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { update, useAgency } from '../api/agency';
import { useLang } from '../store/hooks';
import { alertMessage, alertRequestError } from '../support/alert';
import { FORM_FIELD_TYPE_SUBMIT, FORM_FIELD_TYPE_TEXT } from '../support/form';
import Form from '../components/Form/Form';
import FullScreenLoader from '../components/common/FullScreenLoader';
import Screen from '../components/ui/Screen';
import { ScreenProps } from '../navigation/types';

const FIELDS = [ 'expiry_warning_days', 'oil_warning_km', 'oil_warning_days' ] as const;

// How early the Today screen warns about papers and oil changes, for the whole agency.
export default function RemindersFormScreen({ navigation }: ScreenProps<'RemindersFormScreen'>): React.JSX.Element {
  const { selectedLang } = useLang();
  const queryClient = useQueryClient();
  const { data } = useAgency();
  const [value, setValue] = useState<Record<typeof FIELDS[number], string>|null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (data) {
      setValue({ expiry_warning_days: String(data.expiry_warning_days), oil_warning_km: String(data.oil_warning_km), oil_warning_days: String(data.oil_warning_days) });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: (form: Record<string, string>) => update(Object.fromEntries(FIELDS.map(field => [ field, Number(form[field]) ]))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agency.show'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      alertMessage(selectedLang, 'settings:saved');
      navigation.goBack();
    },
    onError: (error) => alertRequestError(selectedLang, error),
  });

  if (! value) {
    return <FullScreenLoader />;
  }

  return (
    <Screen white>
      <Form
        value={value}
        fields={[
          ...FIELDS.map(field => ({ name: field, label: 'settings:' + field, type: FORM_FIELD_TYPE_TEXT, keyboardType: 'number-pad' })),
          { label: 'common:save', type: FORM_FIELD_TYPE_SUBMIT, isLoading: save.isPending },
        ]}
        onChange={setValue}
        onSubmit={() => {
          const invalid = FIELDS.filter(field => ! /^\d+$/.test(value[field].trim()));
          setErrors(Object.fromEntries(invalid.map(field => [ field, 'validation:invalid' ])));
          if (! invalid.length) {
            save.mutate(value);
          }
        }}
        serverErrors={errors}
      />
    </Screen>
  );
}
