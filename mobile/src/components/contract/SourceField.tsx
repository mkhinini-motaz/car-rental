import { View } from 'react-native';
import Contract, { SOURCE_BROKER, SOURCES } from '../../classes/Contract';
import { commissionFromInput, priceInputFromMillimes } from '../../support/money';
import ChipsField from '../Form/ChipsField';
import TextField from '../Form/TextField';

export interface SourceValue {
  source: number|null,
  broker: string,
  commission: string, // dinars, or a percentage of the total: '10%'
}

export const emptySource: SourceValue = { source: null, broker: '', commission: '' };

export const sourceOf = (contract: Contract): SourceValue => ({
  source: contract.source,
  broker: contract.broker ?? '',
  commission: contract.commission ? priceInputFromMillimes(contract.commission) : '',
});

// The API's fields, or null when the broker's name or the commission can't be used.
export function sourceInput(value: SourceValue, total: number): { source: number|null, broker: string|null, commission: number }|null {
  if (value.source !== SOURCE_BROKER) {
    return { source: value.source, broker: null, commission: 0 };
  }
  const commission = commissionFromInput(value.commission, total);
  return value.broker.trim() && commission !== null ? { source: value.source, broker: value.broker.trim(), commission } : null;
}

// Where the booking came from; a broker (hotel, travel agency, courtier) is named with the
// commission they take, typed in dinars or as a share of the total.
export default function SourceField({ value, onChange, error = false }: { value: SourceValue, onChange: (value: SourceValue) => void, error?: boolean }): React.JSX.Element {
  return (
    <View style={{ gap: 8 }}>
      <ChipsField label='contract:source' value={value.source} options={SOURCES.map(source => ({ label: 'contract:source:' + source, value: source }))} onChange={source => onChange({ ...value, source })} />
      {value.source === SOURCE_BROKER && <>
        <TextField label='contract:broker' value={value.broker} onChange={broker => onChange({ ...value, broker })} error={error && ! value.broker.trim()} />
        <TextField label='contract:commission' value={value.commission} onChange={commission => onChange({ ...value, commission })} keyboardType='numbers-and-punctuation' error={error && !! value.broker.trim()} />
      </>}
    </View>
  );
}
