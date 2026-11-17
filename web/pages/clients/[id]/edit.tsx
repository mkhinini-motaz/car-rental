import { useRouter } from 'next/router';
import ClientForm from '../../../src/components/ClientForm';

export default function EditClientPage() {
  return <ClientForm clientId={Number(useRouter().query.id)} />;
}
