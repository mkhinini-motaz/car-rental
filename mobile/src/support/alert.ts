import Translatable from "../classes/Translatable";
import {Alert} from "react-native";
import {translate} from "../i18n";

export const alertNetworkError = (selectedLang: keyof Translatable) => {
    Alert.alert(
        '',
        translate('network:error', selectedLang),
        [{text: translate('common:ok', selectedLang),}],
    );
};

export const alertConfirmLogout = (selectedLang: keyof Translatable, onConfirm: () => {}) => {
    Alert.alert(
        translate('common:logout:confirm', selectedLang),
        '',
        [
            {
                text: translate('common:cancel', selectedLang),
                style: 'cancel',

            },
            {
                text: translate('common:confirm', selectedLang),
                style: 'destructive',
                onPress: onConfirm,
            },
        ],
        { cancelable: true, },
    );
};


export const alertOccursInPeriod = (selectedLang: keyof Translatable) => {
    Alert.alert(
        translate('car:availability:occurs_in_period', selectedLang),
        '',
        [{text: translate('common:ok', selectedLang),}],
        { cancelable: true, },
    );
};

export const alertMessage = (selectedLang: keyof Translatable, message: string) => {
    Alert.alert('', translate(message, selectedLang), [{ text: translate('common:ok', selectedLang) }]);
};

export const alertConfirm = (selectedLang: keyof Translatable, title: string, onConfirm: () => void) => {
    Alert.alert(
        translate(title, selectedLang),
        '',
        [
            { text: translate('common:cancel', selectedLang), style: 'cancel' },
            { text: translate('common:confirm', selectedLang), style: 'destructive', onPress: onConfirm },
        ],
        { cancelable: true },
    );
};

// Laravel answers invalid input with a 422 and `{ errors: { field: [messages] } }`.
export function validationErrors(error: any): Record<string, string[]> {
    return error?.response?.status === 422 ? (error.response.data?.errors ?? {}) : {};
}

// The API refuses a booking that overlaps another contract of the same car with this message.
export const isOverlapError = (error: any) =>
    Object.values(validationErrors(error)).some(messages => messages.includes('contract:overlap'));

export const alertRequestError = (selectedLang: keyof Translatable, error: any) => {
    if (error?.code === 'ERR_NETWORK') {
        alertNetworkError(selectedLang);
        return;
    }
    if (error?.response?.status === 403) {
        alertMessage(selectedLang, 'common:forbidden'); // owner only
        return;
    }
    alertMessage(selectedLang, isOverlapError(error) ? 'contract:overlap' : 'common:error:happened');
};
