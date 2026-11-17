import React, {memo} from 'react';
import { FORM_FIELD_TYPE_BUTTON, FORM_FIELD_TYPE_COLOR, FORM_FIELD_TYPE_PHOTO, FORM_FIELD_TYPE_DATE, FORM_FIELD_TYPE_PASSWORD, FORM_FIELD_TYPE_PHONE, FORM_FIELD_TYPE_RADIO, FORM_FIELD_TYPE_SUBMIT, FORM_FIELD_TYPE_TEXT, FORM_FIELD_TYPE_OTP } from "../../support/form";
import PhoneField from "./PhoneField";
import PasswordField from "./PasswordField";
import DateField from "./DateField";
import RadioField from "./RadioField";
import TextField from "./TextField";
import Button from '../ui/Button';
import OtpField from "./OtpField";
import ColorField from "./ColorField";
import PhotoField from "./PhotoField";

function FormField({ type, ...props }: any): React.JSX.Element {
    switch (type) {
        case FORM_FIELD_TYPE_PHONE:
            return <PhoneField {...props} />;

        case FORM_FIELD_TYPE_PASSWORD:
            return <PasswordField {...props} />;

        case FORM_FIELD_TYPE_DATE:
            return <DateField {...props} />;

        case FORM_FIELD_TYPE_RADIO:
            return <RadioField {...props} />;

        case FORM_FIELD_TYPE_COLOR:
            return <ColorField {...props} />;

        case FORM_FIELD_TYPE_PHOTO:
            return <PhotoField {...props} />;

        case FORM_FIELD_TYPE_OTP:
            return <OtpField {...props} />;

        case FORM_FIELD_TYPE_SUBMIT:
            return <Button {...props} icon={props.icon ?? 'check'} />;

        case FORM_FIELD_TYPE_BUTTON:
            return <Button variant='secondary' {...props} />;

        case FORM_FIELD_TYPE_TEXT:
        default:
            return <TextField {...props} />
    }
}
export default memo(FormField);
