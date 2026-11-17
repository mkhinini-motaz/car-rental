import React, { memo, useMemo, useState } from 'react';
import { View } from 'react-native';
import DatePicker from './DatePicker';
import { useT } from '../../store/hooks';
import { formatDate } from '../../support/utils';
import TranslatableText from '../common/TranslatableText';
import { useFieldStyles } from './fieldStyles';
import PickerButton from './PickerButton';

interface DateFieldProps {
    value: Date|null,
    label: string,
    onChange: (newValue: Date) => void
    maxDate?: Date,
    minDate?: Date,
    error?: boolean,
    helperText?: string,
}

function DateField({ value, label, onChange, error = false, helperText = '', maxDate = undefined, minDate = undefined }: DateFieldProps): React.JSX.Element {
    const fieldStyles = useFieldStyles();
    const newDate = useMemo(() => new Date(), []);
    const [isOpen, setIsOpen] = useState(false);
    const t = useT();

    return (
        <View style={{ width: '100%' }}>
            <TranslatableText data={label} style={fieldStyles.label} />
            <PickerButton text={value ? formatDate(value.getTime() / 1000) : t('form:date:choose')} icon='calendar' onPress={() => setIsOpen(true)} error={error} />
            <DatePicker
                isOpen={isOpen}
                mode='date'
                value={value || newDate}
                maxDate={maxDate}
                minDate={minDate}
                onConfirm={(date) => {
                    onChange(date);
                    setIsOpen(false);
                }}
                onCancel={() => setIsOpen(false)}
            />
            {!! helperText && <TranslatableText data={helperText} style={fieldStyles.helperText} />}
        </View>
    );
}

export default memo(DateField);
