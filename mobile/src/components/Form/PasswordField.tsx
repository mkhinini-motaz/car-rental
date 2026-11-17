import React, { memo, useState } from 'react';
import { TextInput, TouchableOpacity, View } from 'react-native';
import { useLang } from '../../store/hooks';
import LangAwareView from '../common/LangAwareView';
import TranslatableText from '../common/TranslatableText';
import Icon from '../ui/Icon';
import { useFieldStyles } from './fieldStyles';
import { useColors } from '../../store/ThemeContext';

interface PasswordFieldProps {
    value: string,
    label: string,
    onChange: (newValue: string) => void,
    error?: boolean,
    helperText?: string,
}

// A password with an eye to show what was typed.
function PasswordField({ value, label, onChange, error = false, helperText = '' }: PasswordFieldProps): React.JSX.Element {
    const fieldStyles = useFieldStyles();
    const COLORS = useColors();
    const { selectedLangWriteFrom } = useLang();
    const [isVisible, setIsVisible] = useState(false);

    return (
        <View style={{ width: '100%' }}>
            <TranslatableText data={label} style={fieldStyles.label} />
            <LangAwareView style={{ ...fieldStyles.input, ...(error ? fieldStyles.inputError : {}), alignItems: 'center', paddingVertical: 0, gap: 8 }}>
                <TextInput
                    value={value}
                    onChangeText={onChange}
                    secureTextEntry={! isVisible}
                    style={{ flex: 1, fontSize: 16, color: COLORS.ink, paddingVertical: 10 }}
                    textAlign={selectedLangWriteFrom}
                    autoCapitalize='none'
                />
                <TouchableOpacity onPress={() => setIsVisible(visible => ! visible)} hitSlop={10}>
                    <Icon name={isVisible ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.muted} />
                </TouchableOpacity>
            </LangAwareView>
            {!! helperText && <TranslatableText data={helperText} style={fieldStyles.helperText} />}
        </View>
    );
}

export default memo(PasswordField);
