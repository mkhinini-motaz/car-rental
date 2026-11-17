import { Tone } from '../../constants';
import Badge from '../ui/Badge';

// reserved, out, returned (to settle), closed, cancelled
export const STATUS_TONES: Record<number, Tone> = { 1: 'ink', 2: 'info', 3: 'warn', 4: 'ok', 5: 'muted' };

export default function ContractStatus({ status }: { status: number }): React.JSX.Element {
  return <Badge label={'contract:status:' + status} tone={STATUS_TONES[status]} />;
}
