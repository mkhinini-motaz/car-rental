import React, { memo } from 'react';
import { View } from 'react-native';
import PhoneInput from './PhoneInput';
import TranslatableText from '../common/TranslatableText';
import { useFieldStyles } from './fieldStyles';

interface PhoneFieldProps {
    value: string,
    label: string,
    onChange: (newValue: string|((previousValue: string) => string)) => void,
    error?: boolean,
    helperText?: string,
}

function PhoneField({ value, label, onChange, error = false, helperText = '' }: PhoneFieldProps): React.JSX.Element {
    const fieldStyles = useFieldStyles();
    return (
        <View style={{ width: '100%' }}>
            <TranslatableText data={label} style={fieldStyles.label} />
            <PhoneInput value={value} onChangeText={onChange} style={{ ...fieldStyles.input, ...(error ? fieldStyles.inputError : {}) }} />
            {!! helperText && <TranslatableText data={helperText} style={fieldStyles.helperText} />}
        </View>
    );
}

export default memo(PhoneField);
