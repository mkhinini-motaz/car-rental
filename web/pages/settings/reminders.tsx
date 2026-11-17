import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TextField } from '@mui/material';
import { update, useAgency } from '../../src/api/agency';
import { useT } from '../../src/store/Store';
import { useFeedback } from '../../src/components/Feedback';
import { Loading } from '../../src/components/common';
import SimpleForm from '../../src/components/SimpleForm';

const FIELDS = [ 'expiry_warning_days', 'oil_warning_km', 'oil_warning_days' ] as const;

// How early the Today page warns about papers and oil changes, for the whole agency.
export default function RemindersPage() {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { notify, requestError } = useFeedback();
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
      notify('settings:saved', 'success');
      router.push('/settings');
    },
    onError: requestError,
  });

  if (! value) {
    return <Loading />;
  }
  const onSubmit = () => {
    const invalid = FIELDS.filter(field => ! /^\d+$/.test(value[field].trim()));
    setErrors(Object.fromEntries(invalid.map(field => [ field, 'validation:invalid' ])));
    if (! invalid.length) {
      save.mutate(value);
    }
  };

  return (
    <SimpleForm title='settings:reminders' onSubmit={onSubmit} isSaving={save.isPending}>
      {FIELDS.map(field => <TextField
        key={field}
        label={t('settings:' + field)}
        value={value[field]}
        onChange={event => setValue({ ...value, [field]: event.target.value })}
        error={!! errors[field]}
        helperText={errors[field] && t(errors[field])}
        slotProps={{ htmlInput: { inputMode: 'numeric' } }}
      />)}
    </SimpleForm>
  );
}
