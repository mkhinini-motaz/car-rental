import {PHONE_REGEX} from "../constants";
import {validationErrors} from "./alert";

export const FORM_FIELD_TYPE_TEXT = 'FORM_FIELD_TYPE_TEXT';
export const FORM_FIELD_TYPE_PHONE = 'FORM_FIELD_TYPE_PHONE';
export const FORM_FIELD_TYPE_PASSWORD = 'FORM_FIELD_TYPE_PASSWORD';
export const FORM_FIELD_TYPE_DATE = 'FORM_FIELD_TYPE_DATE';
export const FORM_FIELD_TYPE_RADIO = 'FORM_FIELD_TYPE_RADIO';
export const FORM_FIELD_TYPE_OTP = 'FORM_FIELD_TYPE_OTP';
export const FORM_FIELD_TYPE_SUBMIT = 'FORM_FIELD_TYPE_SUBMIT';
export const FORM_FIELD_TYPE_BUTTON = 'FORM_FIELD_TYPE_BUTTON';
export const FORM_FIELD_TYPE_COLOR = 'FORM_FIELD_TYPE_COLOR';
export const FORM_FIELD_TYPE_PHOTO = 'FORM_FIELD_TYPE_PHOTO';

export const formIsValid = (value: any, fields: any) => {
    const errors: Record<string, boolean> = {};
    const helperTexts: Record<string, string> = {};
    for (let field of fields) {
        if ([FORM_FIELD_TYPE_SUBMIT, FORM_FIELD_TYPE_BUTTON].includes(field.type)) {
            continue;
        }

        if (field.required !== false && !value[field.name]) {
            errors[field.name] = true;
            helperTexts[field.name] = 'validation:required';
        } else if (field.type === FORM_FIELD_TYPE_PHONE) {
            if (! PHONE_REGEX.test(value[field.name])) {
                errors[field.name] = true;
                helperTexts[field.name] = 'validation:phone:invalid';
            }
        } else if ( // TODO: improve code snippet below
            field.name === 'password' &&
            value['password'] !== value['password_confirmation']
        ) {
            errors['password'] = true;
            helperTexts['password'] = 'validation:password:confirmation';
        } else if (
            field.name === 'password_confirmation' &&
            value['password'] !== value['password_confirmation']
        ) {
            errors['password_confirmation'] = true;
            helperTexts['password_confirmation'] = 'validation:password:confirmation';
        }
    }

    return { errors, helperTexts, isValid: 0 === Object.keys(errors).length }
};

// Maps a 422 from the API onto the form's fields: "already taken" gets `takenMessage`, anything else is invalid.
export function serverFieldErrors(error: any, takenMessage = 'validation:taken'): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [field, messages] of Object.entries(validationErrors(error))) {
        result[field] = messages.some(message => message.includes('taken')) ? takenMessage : 'validation:invalid';
    }
    return result;
}
