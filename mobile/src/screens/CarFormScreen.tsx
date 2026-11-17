import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { show, store, update, uploadPhoto } from '../api/car';
import { branches } from '../api/money';
import { useLang, useNetworkErrorAlert } from '../store/hooks';
import { alertRequestError } from '../support/alert';
import { serverFieldErrors } from '../support/form';
import Form from '../components/Form/Form';
import Screen from '../components/ui/Screen';
import FullScreenLoader from '../components/common/FullScreenLoader';
import { carFormFields, carToForm, CarFormValue, emptyCarForm, formToCarInput } from '../components/car/carForm';
import { ScreenProps } from '../navigation/types';

// Adds a car, or edits one when `carId` is given. The photo is uploaded once the car is saved.
export default function CarFormScreen({ route, navigation }: ScreenProps<'CarFormScreen'>): React.JSX.Element {
  const carId = route.params?.carId;
  const { selectedLang } = useLang();
  const queryClient = useQueryClient();
  const [value, setValue] = useState<CarFormValue>(emptyCarForm);
  const [serverErrors, setServerErrors] = useState({});

  const { isLoading, error, data } = useQuery({ queryKey: ['car.show', { id: carId }], queryFn: show, enabled: !! carId });
  const { data: branchList } = useQuery({ queryKey: ['branch.index'], queryFn: branches }); // the car form is the owner's
  useNetworkErrorAlert(error);
  useEffect(() => {
    if (data) {
      setValue(carToForm(data));
    }
  }, [data]);

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const car = carId ? await update(carId, formToCarInput(value)) : await store(formToCarInput(value));
      if (value.photo) {
        // The car is saved either way: a failed upload must not make a retry create it twice.
        try {
          return await uploadPhoto(car.id, value.photo);
        } catch (uploadError) {
          alertRequestError(selectedLang, uploadError);
        }
      }
      return car;
    },
    onSuccess: (car) => {
      for (const key of [ 'car.index', 'car.index.search', 'car.show', 'contract.index', 'dashboard' ]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      if (carId) {
        navigation.goBack();
      } else {
        navigation.replace('CarScreen', { carId: car.id });
      }
    },
    onError: (requestError) => {
      const errors = serverFieldErrors(requestError);
      setServerErrors(errors);
      if (! Object.keys(errors).length) {
        alertRequestError(selectedLang, requestError);
      }
    },
  });

  if (carId && isLoading) {
    return <FullScreenLoader />;
  }

  return (
    <Screen white>
      <Form
        value={value}
        fields={carFormFields(isPending, data?.photo_url, branchList)}
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
