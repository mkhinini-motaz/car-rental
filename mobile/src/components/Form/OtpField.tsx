import React, {memo, useEffect, useRef, useState} from 'react';
import {Alert, TextInput, View} from 'react-native';
import {useLang} from "../../store/hooks";
import Button from '../ui/Button';
import { useFieldStyles } from './fieldStyles';
import {translate} from "../../i18n";
import {requestOtp} from "../../api/auth";
import Translatable from '../../classes/Translatable';
import TranslatableText from '../common/TranslatableText';
import LangAwareView from '../common/LangAwareView';

interface OtpFieldProps {
    value: string,
    label: string,
    onChange: (newValue: string|((previousValue: string) => string)) => void,
    withRequestButton: boolean,
    phone: string|undefined,
    request?: (phone: string, lang: keyof Translatable) => Promise<void>, // a password code by default
}

function OtpField({ value, label, onChange, withRequestButton = false, phone = undefined, request = requestOtp }: OtpFieldProps): React.JSX.Element {
    const fieldStyles = useFieldStyles();
    const { selectedLang, selectedLangWriteFrom } = useLang();

    useEffect(() => () => clearTimeout(timeoutIdRef.current), []);

    const [otpIsLoading, setOtpIsLoading] = useState(false);
    const [requestOtpIsActive, setRequestOtpIsActive] = useState(true);
    const timeoutIdRef = useRef(-1);
    const onOtpRequestPress = () => {
        if (! requestOtpIsActive) {
            Alert.alert('', translate('otp:request:timeout:message', selectedLang), [{ text: translate('common:ok', selectedLang), }]);
            return;
        }
        request(phone!, selectedLang)
            .then(() => {
                Alert.alert('', translate('otp:sent', selectedLang));
                setRequestOtpIsActive(false);
                timeoutIdRef.current = setTimeout(() => setRequestOtpIsActive(true), 60000)
            })
            .catch(() => {
                Alert.alert(
                    translate('otp:request:error:title', selectedLang),
                    translate('otp:request:error:message', selectedLang),
                    [{
                        text: translate('common:ok', selectedLang),
                    }],
                );
            })
            .finally(() => setOtpIsLoading(false));
    };

    return (
        <View style={{ width: '100%', gap: 6 }}>
            <TranslatableText data={label} style={fieldStyles.label} />
            <View style={{ alignItems: selectedLangWriteFrom === 'right' ? 'flex-end' : 'flex-start' }}>
                <LangAwareView style={{ gap: 8, alignItems: 'center' }}>
                    <TextInput
                        value={value}
                        onChangeText={typed => onChange(typed.replace(/\D/g, '').slice(0, 6))}
                        keyboardType='number-pad'
                        maxLength={6}
                        style={{ ...fieldStyles.input, minWidth: 160, letterSpacing: 8 }}
                        textAlign={selectedLangWriteFrom}
                        textContentType='oneTimeCode'
                        autoComplete='sms-otp'
                    />
                    {! withRequestButton ? '' :
                        <Button label='form:otp:request' variant={requestOtpIsActive ? 'primary' : 'secondary'} onPress={onOtpRequestPress} isLoading={otpIsLoading} compact />
                    }
                </LangAwareView>
            </View>
        </View>
    );
}

export default memo(OtpField);
