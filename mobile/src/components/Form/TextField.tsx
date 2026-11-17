import React, { memo } from 'react';
import { KeyboardTypeOptions, TextInput, View } from 'react-native';
import { useLang } from '../../store/hooks';
import TranslatableText from '../common/TranslatableText';
import { useFieldStyles } from './fieldStyles';
import { useColors } from '../../store/ThemeContext';

interface TextFieldProps {
    value: string,
    label: string,
    onChange: (newValue: string) => void,
    keyboardType?: KeyboardTypeOptions,
    error?: boolean,
    helperText?: string,
    multiline?: boolean,
    placeholder?: string,
}

function TextField({ value, label, onChange, error = false, helperText = '', keyboardType = undefined, multiline = false, placeholder }: TextFieldProps): React.JSX.Element {
    const fieldStyles = useFieldStyles();
    const COLORS = useColors();
    const { selectedLangWriteFrom } = useLang();

    return (
        <View style={{ width: '100%' }}>
            <TranslatableText data={label} style={fieldStyles.label} />
            <TextInput
                value={value}
                onChangeText={onChange}
                style={[ fieldStyles.input, error && fieldStyles.inputError, multiline && { minHeight: 96, textAlignVertical: 'top' } ]}
                textAlign={selectedLangWriteFrom}
                keyboardType={keyboardType}
                multiline={multiline}
                placeholder={placeholder}
                placeholderTextColor={COLORS.muted}
            />
            {!! helperText && <TranslatableText data={helperText} style={fieldStyles.helperText} />}
        </View>
    );
}

export default memo(TextField);
