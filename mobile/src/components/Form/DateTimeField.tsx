import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import DatePicker from './DatePicker';
import Translatable from '../../classes/Translatable';
import { useLang } from '../../store/hooks';
import { formatDateTime } from '../../support/utils';
import TranslatableText from '../common/TranslatableText';
import { useFieldStyles } from './fieldStyles';
import PickerButton from './PickerButton';

interface DateTimeFieldProps {
  value: Date,
  label: string,
  onChange: (newValue: Date) => void
  maxDate?: Date | undefined,
  minDate?: Date | undefined,
  minuteInterval?: 1|2|3|4|5|6|10|12|15|20|30, // iOS only
  error?: boolean,
  helperText?: string,
}

const langToLocale = (selectedLang: keyof Translatable) => selectedLang.replace('tn', '');

function DateTimeField({ value, label, onChange, error = false, helperText = '', minDate = undefined, maxDate = undefined, minuteInterval = undefined }: DateTimeFieldProps): React.JSX.Element {
  const fieldStyles = useFieldStyles();
  const newDate = useMemo(() => new Date(), []);
  const { selectedLang } = useLang();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View style={{ flex: 1 }}>
      <TranslatableText data={label} style={fieldStyles.label} />
      <PickerButton text={formatDateTime(value.getTime() / 1000)} icon='calendar-clock' onPress={() => setIsOpen(true)} error={error} />
      <DatePicker
        minDate={minDate}
        maxDate={maxDate}
        value={value || newDate}
        onConfirm={(date) => {
          onChange(date);
          setIsOpen(false);
        }}
        onCancel={() => setIsOpen(false)}
        mode='datetime'
        minuteInterval={minuteInterval}
        locale={langToLocale(selectedLang)}
        isOpen={isOpen}
      />
      {!! helperText && <TranslatableText data={helperText} style={fieldStyles.helperText} />}
    </View>
  );
}

export default DateTimeField;
