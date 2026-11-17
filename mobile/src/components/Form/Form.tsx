import React, {memo} from 'react';
import { StyleSheet, View} from 'react-native';
import FormField from "./FormField";
import {FORM_FIELD_TYPE_SUBMIT, formIsValid} from "../../support/form"
import KeyboardDismissibleAwareScrollView from '../common/KeyboardDismissibleAwareScrollView';

interface FormProps {
    fields: any[], // TODO: change type any
    value: any, // TODO: change type any
    onChange: (newValue: any) => void
    onSubmit: () => void
    serverErrors?: Record<string, string>, // field name → translation key, e.g. from a 422
    children?: React.ReactNode, // below the fields, in the same scroll
}

function Form({ fields, value, onChange, onSubmit, serverErrors = {}, children }: FormProps): React.JSX.Element {
    let [errors, setErrors] = React.useState<Record<string, boolean>>({});
    let [helperTexts, setHelperTexts] = React.useState<Record<string, string>>({});

    const onSubmitClicked = () => {
        const { errors, helperTexts, isValid } = formIsValid(value, fields);
        if (isValid) {
            onSubmit();
            return;
        }
        setErrors(errors);
        setHelperTexts(helperTexts);
    };

    const fieldsComponents = [];
    for (let field of fields) {
        fieldsComponents.push(<FormField {...field}
            key={'form_field_' + field.label + '_' + field.value}
            value={value[field.name]}
            onChange={(newValue: any) => {
                onChange({ ...value, [field.name]: newValue });
                if (errors[field.name]) {
                    const newErrors = { ...errors };
                    const newHelperTexts = { ...helperTexts };
                    delete newErrors[field.name];
                    delete newHelperTexts[field.name];
                    setErrors(newErrors);
                    setHelperTexts(newHelperTexts);
                }
            }}
            onPress={field.type === FORM_FIELD_TYPE_SUBMIT ? onSubmitClicked : field.onPress}
            error={errors[field.name] || !! serverErrors[field.name]}
            helperText={helperTexts[field.name] || serverErrors[field.name]}
        />)
    }

    return (
        <KeyboardDismissibleAwareScrollView>
            <View style={styles.container} >
                {fieldsComponents}
            </View>
            {children}
        </KeyboardDismissibleAwareScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: 18,
        padding: 16,
    }
});

export default memo(Form);
