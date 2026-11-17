import { useEffect, useState } from 'react';
import { Modal, Platform, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import LangAwareView from '../common/LangAwareView';
import Button from '../ui/Button';
import { useColors } from '../../store/ThemeContext';

interface DatePickerProps {
  isOpen: boolean,
  value: Date,
  mode: 'date'|'datetime',
  minDate?: Date,
  maxDate?: Date,
  minuteInterval?: 1|2|3|4|5|6|10|12|15|20|30,
  locale?: string,
  onConfirm: (date: Date) => void,
  onCancel: () => void,
}

// The platform's own picker (@react-native-community/datetimepicker): Android's dialogs (a date,
// then a time for 'datetime'), or an inline calendar in a sheet with OK and Cancel on iOS.
export default function DatePicker({ isOpen, value, mode, minDate, maxDate, minuteInterval, locale, onConfirm, onCancel }: DatePickerProps): React.JSX.Element|null {
  const COLORS = useColors();
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (! isOpen) {
      return;
    }
    setDraft(value);
    if (Platform.OS !== 'android') {
      return;
    }
    DateTimePickerAndroid.open({
      value, mode: 'date', minimumDate: minDate, maximumDate: maxDate,
      onChange: (event, date) => {
        if (event.type !== 'set' || ! date) {
          return onCancel();
        }
        if (mode === 'date') {
          return onConfirm(date);
        }
        DateTimePickerAndroid.open({
          value: date, mode: 'time', is24Hour: true,
          onChange: (timeEvent, time) => timeEvent.type === 'set' && time ? onConfirm(time) : onCancel(),
        });
      },
    });
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (Platform.OS === 'android') {
    return null;
  }
  return (
    <Modal visible={isOpen} transparent animationType='slide' onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0006' }}>
        <SafeAreaView edges={[ 'bottom' ]} style={{ backgroundColor: COLORS.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 12, gap: 8 }}>
          <DateTimePicker
            value={draft}
            mode={mode}
            display='inline'
            minimumDate={minDate}
            maximumDate={maxDate}
            minuteInterval={minuteInterval}
            locale={locale}
            themeVariant='light'
            onChange={(_, date) => date && setDraft(date)}
          />
          <LangAwareView style={{ gap: 8 }}>
            <View style={{ flex: 1 }}><Button label='common:cancel' variant='secondary' onPress={onCancel} /></View>
            <View style={{ flex: 1 }}><Button label='common:ok' onPress={() => onConfirm(draft)} /></View>
          </LangAwareView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
