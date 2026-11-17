import { useRouter } from 'next/router';
import CarForm from '../../../src/components/CarForm';

export default function EditCarPage() {
  return <CarForm carId={Number(useRouter().query.id)} />;
}
