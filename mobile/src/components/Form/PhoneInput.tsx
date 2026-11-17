import React, { memo } from 'react';
import { TextInput, TextStyle } from 'react-native';
import { useLang } from '../../store/hooks';
import { maskPhone } from '../../support/utils';

interface PhoneInputProps {
    value: string,
    onChangeText: (newValue: string) => void,
    style?: TextStyle,
}

// '+216 22 123 456' as it's typed (maskPhone), the prefix kept.
function PhoneInput({ value, onChangeText, style = {} }: PhoneInputProps): React.JSX.Element {
    const { selectedLangWriteFrom } = useLang();

    return (
        <TextInput
            value={value}
            onChangeText={typed => onChangeText(maskPhone(typed))}
            keyboardType='phone-pad'
            style={style}
            textAlign={selectedLangWriteFrom}
        />
    );
};
export default memo(PhoneInput);
